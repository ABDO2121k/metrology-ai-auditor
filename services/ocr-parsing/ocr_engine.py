"""Certificate extraction orchestrator.

Pipeline, in order:

  1. Render every page once, bounded in size (render.py).
  2. Read each page: PDF text layer when present, local OCR otherwise.
  3. Parse fields and measurement rows deterministically (parsing.py).
  4. Optionally refine with a vision model, cross-checked against step 3
     (vision.py).
  5. Recompute the metrology independently and audit it (audit.py).

Step 5 never trusts a value printed on the certificate: error, correction and
guard band are all recomputed, which is what makes the math-discrepancy check
meaningful.
"""

import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

import local_ocr
import parsing
import render
import vision
from audit import (
    audit_chronology,
    audit_conditions,
    audit_measurements,
    audit_pages,
    audit_reference_standard,
    audit_visual,
)
from local_ocr import PageOCR
from schemas import (
    AIDecision,
    AIValidationResult,
    ClientAndDevice,
    DatesAndConditions,
    DocumentInfo,
    ExtractedCertificateData,
    ExtractionDiagnostics,
    FieldProvenance,
    MeasurementRow,
    MetrologicalAuditSummary,
    ReferenceStandardAuditItem,
    UniversalAuditPayload,
    VisualValidation,
)

logger = logging.getLogger(__name__)

MOCK_SENTINEL = "__MOCK__"

# Fields whose absence makes the extraction unusable for an audit.
CRITICAL_FIELDS = ("certificate_number", "client_name", "serial_number")


def is_mock_enabled() -> bool:
    return os.getenv("MOCK_OCR", "false").strip().lower() in ("true", "1", "yes", "on")


# ---------------------------------------------------------------------------
# Page reading
# ---------------------------------------------------------------------------

# Pages are OCR'd concurrently. ONNX Runtime releases the GIL inside its
# native inference calls, so threads give a near-linear speed-up here, and a
# six-page certificate goes from ~110 s to ~30 s — the difference between
# finishing inside the caller's timeout and not.
OCR_WORKERS = max(1, int(os.getenv("OCR_PAGE_WORKERS", "4")))


def read_pages(rendered: render.RenderResult) -> Tuple[List[PageOCR], Optional[str]]:
    """Get text for every page, preferring the PDF's own text layer."""
    results: Dict[int, PageOCR] = {}
    ocr_error: Optional[str] = None
    to_ocr: List[render.RenderedPage] = []

    for page in rendered.pages:
        if page.has_text_layer:
            results[page.page_number] = PageOCR(
                page_number=page.page_number,
                lines=local_ocr.lines_from_text_layer(page.text_layer, page.page_number),
                source="TEXT_LAYER",
            )
        else:
            to_ocr.append(page)

    if to_ocr:
        # Load the model once up front; letting N threads race to initialise it
        # would serialise them on the lock anyway and multiply memory use.
        local_ocr.get_engine()

        workers = min(OCR_WORKERS, len(to_ocr))
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="ocr-page") as pool:
            futures = {
                pool.submit(local_ocr.ocr_image, page.image_bytes, page.page_number): page
                for page in to_ocr
            }
            for future in as_completed(futures):
                page = futures[future]
                try:
                    lines = future.result()
                except Exception as exc:
                    logger.warning("OCR failed on page %s: %s", page.page_number, exc)
                    lines = []
                    ocr_error = f"page {page.page_number}: {exc}"
                if not lines and local_ocr.engine_error():
                    ocr_error = local_ocr.engine_error()
                results[page.page_number] = PageOCR(
                    page_number=page.page_number, lines=lines, source="LOCAL_OCR"
                )

    pages = [results[number] for number in sorted(results)]
    return pages, ocr_error


def transcript_of(pages: Sequence[PageOCR]) -> str:
    chunks = []
    for page in pages:
        if not page.lines:
            continue
        chunks.append(f"--- Page {page.page_number} ({page.source}) ---")
        chunks.append(page.text)
    return "\n".join(chunks)


# ---------------------------------------------------------------------------
# Merging local and vision readings
# ---------------------------------------------------------------------------

class FieldMerger:
    """Chooses a value per field and records where it came from."""

    def __init__(self, local_fields: parsing.ParsedFields, vision_data: Optional[Dict[str, Any]]):
        self.local = local_fields
        self.vision = vision_data or {}
        self.provenance: List[FieldProvenance] = []
        self.disagreements: List[str] = []

    @staticmethod
    def _comparable(value: Optional[str]) -> str:
        return parsing.normalize(value or "").replace(" ", "")

    def resolve(self, field: str, vision_key: Optional[str] = None) -> Optional[str]:
        """Prefer vision, fall back to local, and flag genuine disagreements."""
        vision_key = vision_key or field
        raw_vision = self.vision.get(vision_key)
        vision_value = None if raw_vision is None else str(raw_vision).strip()
        if parsing.is_null_token(vision_value):
            vision_value = None

        local_value = self.local.get(field)
        if parsing.is_null_token(local_value):
            local_value = None

        if vision_value and local_value:
            agree = (
                self._comparable(vision_value) == self._comparable(local_value)
                or self._comparable(vision_value) in self._comparable(local_value)
                or self._comparable(local_value) in self._comparable(vision_value)
            )
            if not agree:
                self.disagreements.append(
                    f"{field}: vision read '{vision_value}', local OCR read '{local_value}'"
                )
            self._record(field, vision_value, "VISION", 0.97 if agree else 0.70, agree)
            return vision_value

        if vision_value:
            # Unconfirmed by the local pass — usable, but not full confidence.
            self._record(field, vision_value, "VISION", 0.85, None)
            return vision_value

        if local_value:
            source = self.local.sources.get(field, "REGEX")
            self._record(field, local_value, source, 0.75, None)
            return local_value

        self._record(field, None, "NONE", 0.0, None)
        return None

    def _record(
        self,
        field: str,
        value: Optional[str],
        source: str,
        confidence: float,
        agreement: Optional[bool],
    ) -> None:
        self.provenance.append(
            FieldProvenance(
                field=field,
                value=value,
                source=source,
                confidence=confidence,
                agreement=agreement,
            )
        )


# ---------------------------------------------------------------------------
# Measurement assembly
# ---------------------------------------------------------------------------

def measurements_from_vision(
    raw_rows: Sequence[Any],
    default_unit: str,
) -> List[MeasurementRow]:
    rows: List[MeasurementRow] = []
    for index, item in enumerate(raw_rows or []):
        if not isinstance(item, dict):
            continue

        reference = parsing.parse_number(item.get("reference_value"))
        nominal = parsing.parse_number(item.get("nominal_value"))
        measured = parsing.parse_number(item.get("measured_value"))

        # A point without a measured value and something to compare it to
        # cannot be audited, so drop it rather than fabricate a zero.
        if measured is None:
            continue
        if reference is None:
            reference = nominal
        if reference is None:
            continue
        if nominal is None:
            nominal = reference

        unit = str(item.get("unit") or default_unit or "").strip()
        uncertainty = parsing.parse_number(item.get("uncertainty_u")) or 0.0
        emt = parsing.parse_number(item.get("emt_limit")) or 0.0

        rows.append(
            MeasurementRow(
                point_index=int(item.get("point_index") or index + 1),
                parameter=(str(item["parameter"]).strip() if item.get("parameter") else None),
                nominal_value=nominal,
                reference_value=reference,
                measured_value=measured,
                unit=unit,
                recorded_error=parsing.parse_number(item.get("recorded_error")),
                calculated_error=0.0,
                calculated_correction=0.0,
                uncertainty_u=abs(uncertainty),
                emt_limit=abs(emt),
                is_return_point=bool(item.get("is_return_point", False)),
            )
        )
    return rows


def measurements_from_table_rows(
    raw_rows: Sequence[parsing.RawTableRow],
    default_unit: str,
) -> Tuple[List[MeasurementRow], Optional[str]]:
    """Reconstruct measurement tables from OCR geometry alone.

    Returns (rows, reason_if_declined).

    A certificate may audit several quantities at once - a multimeter is
    calibrated across V, mV, A, mA and uA ranges, an earth tester across ohm
    and kohm - so every unit section that holds up on its own is accepted, not
    just the largest. Keeping only the biggest group silently discarded whole
    sections of a multi-range certificate.

    Column layouts differ across the lab's form templates and OCR routinely
    drops or merges cells, so a section is only accepted when several
    independent signals agree. When they do not, this returns nothing and says
    why: an empty table flagged for review is recoverable, whereas invented
    points get audited against a real EMT and produce a confident, wrong
    NON_CONFORME.
    """
    # Group by unit alone. Grouping on (unit, column-count) as well was too
    # strict: OCR merges adjacent cells often enough that rows of one table
    # come back with different numeric counts.
    groups: Dict[str, List[parsing.RawTableRow]] = {}
    for raw in raw_rows:
        if not raw.unit:
            continue  # A measurement row always carries its unit.
        if _looks_like_date_row(raw):
            continue
        groups.setdefault(raw.unit, []).append(raw)

    if not groups:
        return [], "no measurement table detected in the local OCR pass"

    accepted: List[MeasurementRow] = []
    rejected_units: List[str] = []

    for unit, candidates in groups.items():
        section = _section_rows(unit, candidates)
        if section:
            accepted.extend(section)
        elif len(candidates) >= 2:
            # Only worth reporting when the unit looked like a real section.
            # A single stray match ("Boite a decades" yielding "a") was never a
            # measurement table, and naming it would just add noise.
            rejected_units.append(unit)

    if not accepted:
        return [], (
            "measurement table structure was not consistent enough to read "
            "reliably without the vision layer"
        )

    # Renumber across sections so point indices stay unique and ordered.
    for index, row in enumerate(accepted, start=1):
        row.point_index = index

    reason = None
    if rejected_units:
        reason = (
            "some sections were skipped as unreadable: "
            + ", ".join(sorted(rejected_units))
        )
    return accepted, reason


def _section_rows(
    unit: str,
    candidates: Sequence[parsing.RawTableRow],
) -> List[MeasurementRow]:
    """Turn one unit's bands into measurement points, or return nothing."""
    # One isolated row is indistinguishable from noise.
    if len(candidates) < 2:
        return []

    rows: List[MeasurementRow] = []
    for raw in candidates:
        numbers = raw.numbers
        # reference, measured, ..., uncertainty, EMT
        if len(numbers) < 4:
            continue

        reference, measured = numbers[0], numbers[1]
        uncertainty, emt = abs(numbers[-2]), abs(numbers[-1])

        # The defining invariant of a calibration point: the instrument reading
        # tracks the reference closely. A row where they diverge wildly means
        # the columns were mis-assigned (a decimal point lost to OCR, or a
        # neighbouring column captured), and auditing it would produce a
        # confident but meaningless NON_CONFORME.
        if not _reading_tracks_reference(reference, measured):
            continue

        # An uncertainty or EMT should be a small fraction of the measured
        # value rather than comparable to it.
        if measured != 0:
            if uncertainty > abs(measured) * 0.5 or emt > abs(measured) * 0.5:
                continue

        rows.append(
            MeasurementRow(
                point_index=len(rows) + 1,
                parameter=None,
                nominal_value=reference,
                reference_value=reference,
                measured_value=measured,
                unit=unit,
                recorded_error=None,
                calculated_error=0.0,
                calculated_correction=0.0,
                uncertainty_u=uncertainty,
                emt_limit=emt,
                is_return_point=False,
            )
        )

    # A section needs at least two surviving rows to be believable.
    return rows if len(rows) >= 2 else []


def _reading_tracks_reference(reference: float, measured: float) -> bool:
    """True when a measured value plausibly belongs to its reference value.

    Instruments are calibrated near their reference points, so a genuine row
    has the two within a few percent. The absolute floor covers points at or
    near zero, where a relative test is meaningless.
    """
    if reference == 0 and measured == 0:
        return True
    scale = max(abs(reference), abs(measured))
    return abs(measured - reference) <= max(scale * 0.10, 1e-6)


def _looks_like_date_row(raw: parsing.RawTableRow) -> bool:
    """Reject bands that are really dates, form codes or page markers.

    'F.CGM V6 du 02/07/2025' parses as four numbers next to a unit token and
    would otherwise be read as a measurement point.
    """
    if parsing.parse_date(raw.text):
        return True
    # A bare year among the values is a strong signal this is metadata.
    return any(1990 <= value <= 2100 and float(value).is_integer() for value in raw.numbers)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_extraction(
    merger: FieldMerger,
    measurements: Sequence[MeasurementRow],
    missing_critical: Sequence[str],
    vision_used: bool,
    ocr_confidence: Optional[float],
) -> Tuple[float, float, str]:
    """Return (confidence, data quality, quality label).

    Confidence reflects how much we trust the *reading*; data quality reflects
    how complete it is. They are deliberately separate: a crisp scan of a
    half-filled form is high confidence and low quality.
    """
    tracked = [p for p in merger.provenance if p.field in CRITICAL_FIELDS or p.value]
    if tracked:
        confidence = sum(p.confidence for p in tracked) / len(tracked)
    else:
        confidence = 0.0

    if ocr_confidence is not None and not vision_used:
        confidence = (confidence + ocr_confidence) / 2.0

    populated = sum(1 for p in merger.provenance if p.value)
    total = max(1, len(merger.provenance))
    data_quality = populated / total

    if not measurements:
        data_quality *= 0.6

    if missing_critical:
        confidence = min(confidence, 0.35)

    if missing_critical or not measurements:
        quality = "POOR"
    elif confidence >= 0.93 and data_quality >= 0.8:
        quality = "EXCELLENT"
    elif confidence >= 0.8:
        quality = "HIGH"
    elif confidence >= 0.6:
        quality = "MEDIUM"
    else:
        quality = "POOR"

    return round(confidence, 4), round(data_quality, 4), quality


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def extract_pdf_data(pdf_path: str, certificate_id: str) -> ExtractedCertificateData:
    started = time.perf_counter()

    if pdf_path == MOCK_SENTINEL or is_mock_enabled():
        return _mock_result(certificate_id)

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    # ---- 1. Render -------------------------------------------------------
    rendered = render.render_pdf(pdf_path)
    pipeline: List[str] = ["RENDER"]

    # ---- 2. Read ---------------------------------------------------------
    pages, ocr_error = read_pages(rendered)
    if any(page.source == "TEXT_LAYER" for page in pages):
        pipeline.append("TEXT_LAYER")
    local_ocr_used = any(page.source == "LOCAL_OCR" and page.lines for page in pages)
    if local_ocr_used:
        pipeline.append("LOCAL_OCR")

    all_lines = [line for page in pages for line in page.lines]
    transcript = transcript_of(pages)

    # A scan that yields almost nothing is usually under-resolved; one retry at
    # higher resolution is far cheaper than a failed extraction.
    if len(transcript.strip()) < 200 and rendered.max_side < render.DEFAULT_RETRY_MAX_SIDE:
        logger.info("Sparse first pass (%d chars); retrying at higher resolution", len(transcript))
        rendered = render.render_pdf(pdf_path, max_side=render.DEFAULT_RETRY_MAX_SIDE)
        pages, ocr_error = read_pages(rendered)
        all_lines = [line for page in pages for line in page.lines]
        transcript = transcript_of(pages)
        pipeline.append("LOCAL_OCR_RETRY")

    # ---- 3. Deterministic parse -----------------------------------------
    local_fields = parsing.extract_fields(all_lines)
    table_rows = parsing.find_table_rows(all_lines)
    units_seen = parsing.collect_units(table_rows)

    # ---- 4. Vision refinement -------------------------------------------
    vision_result: Dict[str, Any] = {"data": None, "error": None, "model": None}
    if vision.is_configured():
        vision_result = vision.extract(rendered.pages, transcript, max_pages=render.MAX_VISION_PAGES)
        if vision_result["data"]:
            pipeline.append("VISION")
    else:
        vision_result["error"] = (
            "vision layer not configured (set OPENAI_API_KEY to enable)"
        )

    vision_data = vision_result["data"]
    merger = FieldMerger(local_fields, vision_data)

    certificate_number = merger.resolve("certificate_number")
    client_name = merger.resolve("client_name")
    client_address = merger.resolve("client_address")
    instrument_name = merger.resolve("instrument_name")
    manufacturer = merger.resolve("manufacturer")
    model_name = merger.resolve("model")
    serial_number = merger.resolve("serial_number")
    internal_code = merger.resolve("internal_code")
    operator_name = merger.resolve("operator_name")
    approver_name = merger.resolve("approver_name")
    form_code = merger.resolve("form_code")

    calibration_date = parsing.parse_date(merger.resolve("calibration_date"))
    issue_date = parsing.parse_date(merger.resolve("issue_date"))
    validation_date = parsing.parse_date(merger.resolve("validation_date"))
    next_calibration_date = parsing.parse_date(merger.resolve("next_calibration_date"))

    temperature_raw = merger.resolve("ambient_temperature")
    humidity_raw = merger.resolve("ambient_humidity")
    if not temperature_raw:
        temperature_raw, _ = parsing.extract_temperature(transcript)
    if not humidity_raw:
        humidity_raw, _ = parsing.extract_humidity(transcript)
    temperature_value = parsing.parse_number(temperature_raw)
    humidity_value = parsing.parse_number(humidity_raw)

    # ---- Domain and measurements ----------------------------------------
    # Provisional domain from wording alone. Unit-based voting is only
    # trustworthy once we have a real measurement table: stray "min" or "s"
    # tokens scattered through a header would otherwise outvote the
    # instrument's own name (an "AGITATEUR" is never a timing calibration).
    keyword_domain = parsing.detect_domain(
        f"{transcript} {instrument_name or ''}", None
    )

    table_decline_reason: Optional[str] = None
    if vision_data and vision_data.get("measurements"):
        provisional_unit = parsing.DOMAIN_DEFAULT_UNIT.get(keyword_domain, "")
        measurements = measurements_from_vision(
            vision_data["measurements"], provisional_unit
        )
        measurement_source = "VISION"
    else:
        provisional_unit = parsing.DOMAIN_DEFAULT_UNIT.get(keyword_domain, "")
        measurements, table_decline_reason = measurements_from_table_rows(
            table_rows, provisional_unit
        )
        measurement_source = "LOCAL_TABLE"

    vision_domain = (vision_data or {}).get("domain")
    if vision_domain and str(vision_domain).upper() != "UNKNOWN":
        domain = str(vision_domain).upper()
    elif measurements:
        # Units taken from accepted rows are authoritative.
        domain = parsing.detect_domain(
            f"{transcript} {instrument_name or ''}",
            [row.unit for row in measurements if row.unit],
        )
    else:
        domain = keyword_domain
    default_unit = parsing.DOMAIN_DEFAULT_UNIT.get(domain, "")

    for row in measurements:
        if not row.unit:
            row.unit = default_unit

    # ---- Stamp / signature ----------------------------------------------
    if vision_data is not None:
        has_stamp = bool(vision_data.get("has_stamp_logo", False))
        has_signature = bool(vision_data.get("has_signature", False))
    else:
        # Without a visual pass we cannot see a stamp. Say so rather than
        # asserting a default that would silently pass the visual audit.
        haystack = parsing.normalize(transcript)
        has_stamp = any(k in haystack for k in ("ACCREDITATION", "SEMAC", "COFRAC", "CACHET"))
        has_signature = any(k in haystack for k in ("SIGNATURE", "SIGNE", "VISA", "APPROUVE PAR"))

    # ---- Reference standards --------------------------------------------
    reference_standards = _reference_standards(
        vision_data, transcript, calibration_date, certificate_number
    )
    standard_code = reference_standards[0].connection_code if reference_standards else None
    standard_expiry = reference_standards[0].validity_date if reference_standards else None

    # ---- Amendment -------------------------------------------------------
    if vision_data is not None and vision_data.get("is_amendment") is not None:
        is_amendment = bool(vision_data.get("is_amendment"))
        superseded = vision_data.get("superseded_certificate")
    else:
        is_amendment, superseded = parsing.detect_amendment(certificate_number, transcript)

    # ---- Page counts -----------------------------------------------------
    announced_pages = None
    announced_is_reliable = False
    if vision_data:
        announced_pages = parsing.parse_number(vision_data.get("announced_pages"))
        announced_pages = int(announced_pages) if announced_pages else None
        announced_is_reliable = announced_pages is not None
    if announced_pages is None:
        announced_pages = _announced_pages_from_text(transcript)
    actual_pages = render.count_pdf_pages(pdf_path)

    # ---- 5. Audit --------------------------------------------------------
    measurements, outcome = audit_measurements(measurements)
    audit_pages(outcome, announced_pages, actual_pages, announced_is_reliable)
    audit_chronology(outcome, calibration_date, issue_date, validation_date, next_calibration_date)
    audit_reference_standard(outcome, calibration_date, standard_expiry, standard_code)
    audit_conditions(outcome, temperature_value, humidity_value)
    audit_visual(outcome, has_stamp, has_signature)

    missing_critical = []
    if not certificate_number:
        missing_critical.append("Certificate number missing or illegible")
    if not client_name:
        missing_critical.append("Client name missing or illegible")
    if not serial_number:
        missing_critical.append("Instrument serial number missing or illegible")
    for message in missing_critical:
        outcome.block(message)

    if not measurements:
        detail = f" ({table_decline_reason})" if table_decline_reason else ""
        outcome.block(
            f"No measurement points could be extracted from the certificate{detail}"
        )
        if table_decline_reason and not vision.is_configured():
            outcome.suggest(
                "Enable the vision layer (OPENAI_API_KEY) to read measurement "
                "tables from scanned certificates, or capture the points manually"
            )
    elif table_decline_reason:
        # Some sections read cleanly and others did not. The certificate is
        # therefore only partially audited, which the reviewer must be told.
        outcome.warn(
            f"Measurement table read only in part - {table_decline_reason}"
        )

    # A locally-reconstructed table has no column headers to bind meaning to:
    # the fourth number on a row could be the EMT or the uncertainty depending
    # on the form template. The rows themselves are worth surfacing, but a
    # CONFORME/NON_CONFORME verdict built on a guessed column mapping would be
    # unfounded, so it is withheld and the points are sent for human review.
    columns_are_inferred = measurement_source == "LOCAL_TABLE" and bool(measurements)
    if columns_are_inferred:
        outcome.conformity_status = "INDETERMINE"
        outcome.blocking_anomalies = [
            issue for issue in outcome.blocking_anomalies
            if "exceeds EMT" not in issue
        ]
        outcome.warn(
            f"{len(measurements)} measurement point(s) were reconstructed from "
            "raw OCR without column headers; the reference/uncertainty/EMT "
            "mapping is inferred and conformity was not decided"
        )
        for row in measurements:
            row.is_conforme = True

    for message in merger.disagreements:
        outcome.warn(f"Reading disagreement - {message}")

    if vision_result.get("error") and not vision_data:
        outcome.suggest(f"Vision layer unavailable: {vision_result['error']}")
    if ocr_error:
        outcome.suggest(f"Local OCR degraded: {ocr_error}")

    unreadable = (vision_data or {}).get("unreadable_fields") or []
    for name in unreadable:
        outcome.warn(f"Field reported unreadable by vision pass: {name}")

    ocr_confidence = local_ocr.mean_confidence(pages)
    confidence, data_quality, quality = score_extraction(
        merger, measurements, missing_critical, bool(vision_data), ocr_confidence
    )

    validation_passed = not outcome.blocking_anomalies
    overall_status = "COMPLETED" if validation_passed else "FLAGGED_ANOMALY"

    if not validation_passed:
        # A clean read that found real problems is a review job; a poor read is
        # a re-scan job. Distinguishing them keeps the operator's queue honest.
        recommendation = (
            "NEEDS_HUMAN_REVIEW" if quality in ("EXCELLENT", "HIGH") else "REJECTED"
        )
    elif columns_are_inferred:
        # Nothing blocked, but conformity was never actually decided.
        recommendation = "NEEDS_HUMAN_REVIEW"
    else:
        recommendation = "VALIDATED"

    measurement_validity = 1.0
    if measurements:
        conforming = sum(1 for row in measurements if row.is_conforme)
        measurement_validity = round(conforming / len(measurements), 4)
    else:
        measurement_validity = 0.0

    duration_ms = int((time.perf_counter() - started) * 1000)

    diagnostics = ExtractionDiagnostics(
        engine_pipeline=pipeline,
        vision_model=vision_result.get("model"),
        vision_used=bool(vision_data),
        vision_error=vision_result.get("error"),
        local_ocr_used=local_ocr_used,
        local_ocr_error=ocr_error,
        text_layer_chars=rendered.text_layer_chars,
        ocr_chars=len(transcript),
        ocr_mean_confidence=ocr_confidence,
        pages_rendered=rendered.page_count,
        render_max_side=rendered.max_side,
        render_bytes_total=rendered.total_bytes,
        duration_ms=duration_ms,
        field_provenance=merger.provenance,
        disagreements=merger.disagreements,
    )

    universal_payload = UniversalAuditPayload(
        document_info=DocumentInfo(
            certificate_number=certificate_number or "",
            form_code=form_code,
            domain=domain,
            is_amendment=is_amendment,
            superseded_certificate=superseded,
            is_new_template_detected=(form_code is None and domain == "UNKNOWN"),
            announced_pages=announced_pages or actual_pages,
            extracted_pages=actual_pages,
            page_integrity_pass=outcome.page_integrity_pass,
        ),
        client_and_device=ClientAndDevice(
            client_name=client_name or "",
            client_address=client_address,
            device_designation=instrument_name or "",
            manufacturer=manufacturer,
            model=model_name,
            serial_number=serial_number or "",
            internal_code=internal_code,
        ),
        dates_and_conditions=DatesAndConditions(
            calibration_date=calibration_date,
            issue_date=issue_date,
            validation_date=validation_date,
            next_calibration_date=next_calibration_date,
            chronology_valid=outcome.chronology_valid,
            chronology_issues=outcome.chronology_issues,
            ambient_temperature=temperature_raw,
            ambient_humidity=humidity_raw,
            temperature_celsius=temperature_value,
            humidity_percent=humidity_value,
            conditions_valid=outcome.conditions_valid,
        ),
        reference_standards_audit=reference_standards,
        visual_validation=VisualValidation(
            lab_logo_present=has_stamp,
            accreditation_logo_present=has_stamp,
            validation_stamp_present=has_stamp,
            signatures_present=has_signature,
            operator_name=operator_name,
            approver_name=approver_name,
        ),
        metrological_audit=MetrologicalAuditSummary(
            total_points_tested=len(measurements),
            math_errors_detected=outcome.math_errors_detected,
            non_conforme_points=outcome.non_conforme_points,
            hysteresis_failures=outcome.hysteresis_failures,
            conformity_status=outcome.conformity_status,
            parameters_audited=sorted({row.parameter or domain for row in measurements}),
        ),
        ai_decision=AIDecision(
            overall_status=overall_status,
            validation_recommendation=recommendation,
            confidence_score=round(confidence * 100, 1),
            blocking_anomalies=outcome.blocking_anomalies,
            warnings=outcome.warnings,
        ),
    )

    return ExtractedCertificateData(
        certificate_id=certificate_id,
        certificate_number=certificate_number or "",
        client_name=client_name or "",
        instrument_name=instrument_name or "",
        instrument_serial=serial_number or "",
        announced_page_count=announced_pages or actual_pages,
        actual_extracted_pages=actual_pages,
        issue_date=issue_date,
        calibration_date=calibration_date,
        next_calibration_date=next_calibration_date,
        ambient_temperature=temperature_raw,
        ambient_humidity=humidity_raw,
        reference_standard_code=standard_code,
        reference_standard_expiry=standard_expiry,
        has_stamp_logo=has_stamp,
        has_signature=has_signature,
        measurements=measurements,
        ai_validation=AIValidationResult(
            confidence_score=confidence,
            data_quality_score=data_quality,
            measurement_validity_score=measurement_validity,
            extraction_quality=quality,
            critical_issues=outcome.blocking_anomalies,
            warnings=outcome.warnings,
            suggestions=outcome.suggestions,
            validation_passed=validation_passed,
            validation_timestamp=datetime.now(timezone.utc).isoformat(),
        ),
        universal_payload=universal_payload,
        diagnostics=diagnostics,
        raw_text=transcript,
        is_mocked=False,
    )


def _same_code(candidate: str, certificate_number: Optional[str]) -> bool:
    """True when two identifiers differ only by OCR-level noise.

    Digits and letters are routinely confused on these scans (0/O, 1/I, 5/S,
    8/G), so codes are compared on a folded form.
    """
    if not certificate_number:
        return False

    folded = str.maketrans({"O": "0", "I": "1", "L": "1", "S": "5", "G": "6", "B": "8"})

    def fold(value: str) -> str:
        return re.sub(r"[^A-Z0-9]", "", value.upper()).translate(folded)

    left, right = fold(candidate), fold(certificate_number)
    if not left or not right:
        return False
    # A truncated read ("ARB113361-2" for "ARBI13361-26") still counts.
    return left == right or left.startswith(right[:8]) or right.startswith(left[:8])


def _reference_standards(
    vision_data: Optional[Dict[str, Any]],
    transcript: str,
    calibration_date: Optional[str],
    certificate_number: Optional[str] = None,
) -> List[ReferenceStandardAuditItem]:
    items: List[ReferenceStandardAuditItem] = []

    raw_items = (vision_data or {}).get("reference_standards") or []
    for entry in raw_items:
        if not isinstance(entry, dict):
            continue
        designation = str(entry.get("designation") or "").strip()
        if not designation:
            continue
        validity = parsing.parse_date(entry.get("validity_date"))
        is_valid = True
        if calibration_date and validity:
            is_valid = calibration_date <= validity
        items.append(
            ReferenceStandardAuditItem(
                designation=designation,
                connection_code=(str(entry["connection_code"]).strip() if entry.get("connection_code") else None),
                validity_date=validity,
                is_valid_at_calibration=is_valid,
            )
        )

    if items:
        return items

    # Local fallback: the traceability block names a standard and its validity.
    #
    # The code must contain a digit. Equipment identifiers on these
    # certificates always do (CAPIO2, AEPI06457-26, CECF4/12314), and requiring
    # one stops the pattern latching onto ordinary words - the previous
    # letters-only regex matched "NAGE", the tail of "ETALONNAGE" itself.

    code = None
    for line in transcript.splitlines():
        flat = parsing.strip_accents(line).upper()
        if not any(key in flat for key in ("ETALON", "RACCORDEMENT", "STANDARD", "REFERENCE")):
            continue
        # "CERTIFICAT D'ETALONNAGE N°ARRM13388-26" trips the ETALON trigger and
        # would hand back the certificate's own number as its reference standard.
        if "CERTIFICAT" in flat:
            continue
        candidate = re.search(r"\b([A-Z]{2,6}[0-9][A-Z0-9\-/]*)\b", line.upper())
        if not candidate or parsing.is_footer_line(line):
            continue
        # The document's own number is not its reference standard. OCR noise
        # means an exact comparison is not enough (ARRM13388-26 vs
        # ARRM1338G-26), so near-matches are rejected too.
        if _same_code(candidate.group(1), certificate_number):
            continue
        code = candidate.group(1)
        break

    validity_match = re.search(
        r"validit[ée][^\n:]*[:\s]\s*([^\n]{0,30})",
        transcript,
        re.IGNORECASE,
    )
    validity = parsing.parse_date(validity_match.group(1)) if validity_match else None

    if code or validity:
        is_valid = True
        if calibration_date and validity:
            is_valid = calibration_date <= validity
        items.append(
            ReferenceStandardAuditItem(
                designation="Reference standard (traceability block)",
                connection_code=code,
                validity_date=validity,
                is_valid_at_calibration=is_valid,
            )
        )
    return items


def _announced_pages_from_text(transcript: str) -> Optional[int]:
    """Recover the announced page count from the title block.

    Two forms appear on these certificates: an explicit declaration ("Ce
    certificat comprend 3 pages"), preferred, and the running "page 1 sur 3"
    footer marker as a fallback. Both are read by OCR, where a single misread
    digit invents a page-count discrepancy, so a mismatch found this way is
    reported as a warning; only a count read by the vision layer blocks.
    """

    flat = parsing.strip_accents(transcript)

    # OCR drops inter-word spaces on these scans, so match with them optional.
    declaration = re.search(
        r"ce\s*certificat\s*(?:comprend|contient|comporte)\s*(\d{1,2})\s*page",
        flat.replace(" ", " "), re.IGNORECASE,
    )
    if not declaration:
        declaration = re.search(
            r"cecertificat(?:comprend|contient|comporte)(\d{1,2})page",
            re.sub(r"\s+", "", flat), re.IGNORECASE,
        )
    if declaration:
        total = int(declaration.group(1))
        if 1 <= total <= 60:
            return total

    best: Optional[int] = None
    for match in re.finditer(
        r"page\s*\d{1,2}\s*(?:/|sur|de|of)\s*(\d{1,2})",
        flat, re.IGNORECASE,
    ):
        total = int(match.group(1))
        if 1 <= total <= 60:
            best = total if best is None else max(best, total)
    return best


def _mock_result(certificate_id: str) -> ExtractedCertificateData:
    """Fixed sample used by MOCK_OCR for UI work without a running OCR stack."""
    measurements = [
        MeasurementRow(
            point_index=1, parameter="Vitesse de rotation",
            nominal_value=75.0, reference_value=75.0, measured_value=75.0,
            unit="tr/min", recorded_error=0.0, calculated_error=0.0,
            calculated_correction=0.0, uncertainty_u=0.4, emt_limit=1.0,
        ),
        MeasurementRow(
            point_index=2, parameter="Vitesse de rotation",
            nominal_value=300.0, reference_value=300.0, measured_value=299.99,
            unit="tr/min", recorded_error=-0.01, calculated_error=0.0,
            calculated_correction=0.0, uncertainty_u=0.4, emt_limit=1.0,
        ),
        MeasurementRow(
            point_index=3, parameter="Vitesse de rotation",
            nominal_value=500.0, reference_value=500.0, measured_value=499.97,
            unit="tr/min", recorded_error=0.0, calculated_error=0.0,
            calculated_correction=0.0, uncertainty_u=0.4, emt_limit=1.0,
        ),
    ]
    measurements, outcome = audit_measurements(measurements)

    return ExtractedCertificateData(
        certificate_id=certificate_id,
        certificate_number="ARTL05391-26/A",
        client_name="TTEC LAB",
        instrument_name="TACHYMETRE",
        instrument_serial="C172450726",
        announced_page_count=3,
        actual_extracted_pages=3,
        issue_date="2026-04-15",
        calibration_date="2026-04-10",
        next_calibration_date="2027-04-10",
        ambient_temperature="23 ± 2 °C",
        ambient_humidity="≤ 80 %HR",
        reference_standard_code="CAPIO2",
        reference_standard_expiry="2027-07-28",
        has_stamp_logo=True,
        has_signature=True,
        measurements=measurements,
        ai_validation=AIValidationResult(
            confidence_score=1.0,
            data_quality_score=1.0,
            measurement_validity_score=1.0,
            extraction_quality="EXCELLENT",
            critical_issues=[],
            warnings=outcome.warnings,
            suggestions=["MOCK_OCR is enabled - this is fixture data, not a real extraction"],
            validation_passed=True,
            validation_timestamp=datetime.now(timezone.utc).isoformat(),
        ),
        universal_payload=UniversalAuditPayload(
            document_info=DocumentInfo(
                certificate_number="ARTL05391-26/A", form_code="FICTA V5",
                domain="ROTATION-SPEED", is_amendment=True,
                superseded_certificate="ARTL05391-26", is_new_template_detected=False,
                announced_pages=3, extracted_pages=3, page_integrity_pass=True,
            ),
            client_and_device=ClientAndDevice(
                client_name="TTEC LAB",
                client_address="Lot N 874 Rue ARRIAD, ZI Al Majd Tanger",
                device_designation="TACHYMETRE", manufacturer="UNI-T", model="UT371",
                serial_number="C172450726", internal_code="TAC 01",
            ),
            dates_and_conditions=DatesAndConditions(
                calibration_date="2026-04-10", issue_date="2026-04-15",
                next_calibration_date="2027-04-10", chronology_valid=True,
                ambient_temperature="23 ± 2 °C", ambient_humidity="≤ 80 %HR",
                temperature_celsius=23.0, humidity_percent=80.0, conditions_valid=True,
            ),
            reference_standards_audit=[
                ReferenceStandardAuditItem(
                    designation="Générateur de fréquence", connection_code="CAPIO2",
                    validity_date="2027-07-28", is_valid_at_calibration=True,
                )
            ],
            visual_validation=VisualValidation(
                operator_name="M. SERE", approver_name="M. David OUOBA",
            ),
            metrological_audit=MetrologicalAuditSummary(
                total_points_tested=3,
                math_errors_detected=outcome.math_errors_detected,
                conformity_status=outcome.conformity_status,
                parameters_audited=["Vitesse de rotation"],
            ),
            ai_decision=AIDecision(
                overall_status="COMPLETED", validation_recommendation="VALIDATED",
                confidence_score=98.0, blocking_anomalies=[], warnings=outcome.warnings,
            ),
        ),
        diagnostics=ExtractionDiagnostics(engine_pipeline=["MOCK"], vision_used=False),
        is_mocked=True,
    )
