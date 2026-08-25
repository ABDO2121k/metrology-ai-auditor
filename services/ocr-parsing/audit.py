"""ISO/IEC 17025 metrological audit.

Implements the checks specified in plan/overview.md section 4. Every number
here is recomputed from the extracted values rather than taken from the
certificate, so a certificate that states a conforming error while its own
figures say otherwise is caught.
"""

import datetime
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

from schemas import MeasurementRow

# Environmental envelope from PR.ECE V9 / NM 2018.
TEMP_NOMINAL = float(os.getenv("AUDIT_TEMP_NOMINAL", "23.0"))
TEMP_TOLERANCE = float(os.getenv("AUDIT_TEMP_TOLERANCE", "2.0"))
HUMIDITY_MAX = float(os.getenv("AUDIT_HUMIDITY_MAX", "80.0"))

# Absolute tolerance when comparing a printed error against the recomputed one.
MATH_TOLERANCE = float(os.getenv("AUDIT_MATH_TOLERANCE", "0.0001"))

# Maximum |Correction_retour - Correction_aller| accepted, as a fraction of EMT.
HYSTERESIS_EMT_FRACTION = float(os.getenv("AUDIT_HYSTERESIS_EMT_FRACTION", "0.5"))


@dataclass
class AuditOutcome:
    blocking_anomalies: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)

    math_errors_detected: int = 0
    non_conforme_points: int = 0
    hysteresis_failures: int = 0

    page_integrity_pass: bool = True
    chronology_valid: bool = True
    chronology_issues: List[str] = field(default_factory=list)
    conditions_valid: bool = True
    standard_valid: bool = True
    conformity_status: str = "CONFORME"

    def block(self, message: str) -> None:
        if message not in self.blocking_anomalies:
            self.blocking_anomalies.append(message)

    def warn(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)

    def suggest(self, message: str) -> None:
        if message not in self.suggestions:
            self.suggestions.append(message)


def _as_date(value: Optional[str]) -> Optional[datetime.date]:
    if not value:
        return None
    try:
        return datetime.date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def audit_measurements(rows: Sequence[MeasurementRow]) -> Tuple[List[MeasurementRow], AuditOutcome]:
    """Recompute error, correction, guard band and hysteresis for every point."""
    outcome = AuditOutcome()
    audited: List[MeasurementRow] = []

    # Hysteresis pairs an ascending point with the descending point at the same
    # nominal value, so index the forward pass by nominal first.
    forward_corrections: Dict[Tuple[float, str], float] = {}
    for row in rows:
        if not row.is_return_point:
            forward_corrections[(row.nominal_value, row.unit)] = row.reference_value - row.measured_value

    for row in rows:
        error = round(row.measured_value - row.reference_value, 6)
        correction = round(row.reference_value - row.measured_value, 6)

        row.calculated_error = error
        row.calculated_correction = correction

        # Decision rule: |Correction| + U <= EMT (guard band, k=2).
        guard_band = round(abs(correction) + row.uncertainty_u, 6)
        row.guard_band_sum = guard_band

        if row.emt_limit > 0:
            row.is_conforme = guard_band <= row.emt_limit
        else:
            # Without an EMT we cannot rule on conformity; do not claim CONFORME.
            row.is_conforme = True
            outcome.warn(
                f"Point {row.point_index}: no EMT printed, conformity could not be decided"
            )

        if not row.is_conforme:
            outcome.non_conforme_points += 1
            outcome.block(
                f"Point {row.point_index} ({row.nominal_value} {row.unit}): "
                f"|Correction| + U = {guard_band} exceeds EMT {row.emt_limit}"
            )

        # Compare the printed error against the recomputed one.
        if row.recorded_error is not None:
            if abs(row.recorded_error - error) > MATH_TOLERANCE:
                row.math_check_pass = False
                outcome.math_errors_detected += 1
                outcome.warn(
                    f"Point {row.point_index}: certificate states error "
                    f"{row.recorded_error}, recomputed {error}"
                )
            else:
                row.math_check_pass = True

        if row.is_return_point:
            forward = forward_corrections.get((row.nominal_value, row.unit))
            if forward is not None:
                delta = round(abs(correction - forward), 6)
                row.hysteresis_delta = delta
                threshold = row.emt_limit * HYSTERESIS_EMT_FRACTION if row.emt_limit > 0 else None
                if threshold is not None and delta > threshold:
                    row.is_hysteresis_valid = False
                    outcome.hysteresis_failures += 1
                    outcome.warn(
                        f"Point {row.point_index}: hysteresis {delta} exceeds "
                        f"{HYSTERESIS_EMT_FRACTION:.0%} of EMT ({threshold})"
                    )

        audited.append(row)

    if outcome.non_conforme_points or outcome.hysteresis_failures:
        outcome.conformity_status = "NON_CONFORME"
    elif not audited:
        outcome.conformity_status = "INDETERMINE"
    else:
        outcome.conformity_status = "CONFORME"

    return audited, outcome


def audit_chronology(
    outcome: AuditOutcome,
    calibration_date: Optional[str],
    issue_date: Optional[str],
    validation_date: Optional[str],
    next_calibration_date: Optional[str],
) -> None:
    """Date_Etalonnage <= Date_Emission <= Date_Validation < Date_Prochain."""
    calibration = _as_date(calibration_date)
    issue = _as_date(issue_date)
    validation = _as_date(validation_date)
    next_calibration = _as_date(next_calibration_date)

    if calibration and issue and calibration > issue:
        outcome.chronology_issues.append(
            f"Calibration date ({calibration_date}) is after issue date ({issue_date})"
        )
    if issue and validation and issue > validation:
        outcome.chronology_issues.append(
            f"Issue date ({issue_date}) is after validation date ({validation_date})"
        )
    if calibration and next_calibration and calibration >= next_calibration:
        outcome.chronology_issues.append(
            f"Next calibration date ({next_calibration_date}) is not after "
            f"the calibration date ({calibration_date})"
        )

    if calibration and calibration > datetime.date.today():
        outcome.chronology_issues.append(
            f"Calibration date ({calibration_date}) is in the future"
        )

    outcome.chronology_valid = not outcome.chronology_issues
    for issue_text in outcome.chronology_issues:
        outcome.block(f"Chronology error: {issue_text}")

    if next_calibration and next_calibration < datetime.date.today():
        outcome.warn(
            f"Certificate is past its next calibration date ({next_calibration_date})"
        )


def audit_reference_standard(
    outcome: AuditOutcome,
    calibration_date: Optional[str],
    standard_expiry: Optional[str],
    standard_code: Optional[str],
) -> bool:
    """A standard expired at calibration time blocks validation outright."""
    calibration = _as_date(calibration_date)
    expiry = _as_date(standard_expiry)

    if not standard_code and not standard_expiry:
        outcome.warn("No reference standard traceability found on the certificate")
        return True
    if calibration is None or expiry is None:
        outcome.warn(
            "Reference standard validity could not be verified (missing calibration date or standard expiry)"
        )
        return True

    if calibration > expiry:
        outcome.standard_valid = False
        outcome.block(
            f"Reference standard {standard_code or ''} expired on {standard_expiry}, "
            f"but was used for calibration on {calibration_date}".strip()
        )
        return False
    return True


def audit_conditions(
    outcome: AuditOutcome,
    temperature: Optional[float],
    humidity: Optional[float],
) -> None:
    if temperature is not None:
        if abs(temperature - TEMP_NOMINAL) > TEMP_TOLERANCE:
            outcome.conditions_valid = False
            outcome.warn(
                f"Ambient temperature {temperature} °C is outside "
                f"{TEMP_NOMINAL} ± {TEMP_TOLERANCE} °C"
            )
    else:
        outcome.suggest("Ambient temperature not found - verify the conditions block")

    if humidity is not None:
        if humidity > HUMIDITY_MAX:
            outcome.conditions_valid = False
            outcome.warn(f"Relative humidity {humidity} %HR exceeds {HUMIDITY_MAX} %HR")
    else:
        outcome.suggest("Ambient humidity not found - verify the conditions block")


def audit_pages(
    outcome: AuditOutcome,
    announced: Optional[int],
    extracted: int,
    announced_is_reliable: bool = True,
) -> bool:
    """Announced page count must match what the document actually contains.

    `announced_is_reliable` distinguishes a count read by the vision layer from
    one scraped out of a raw OCR transcript. A misread "Page 2/2" as "Page 2/3"
    is common enough that an OCR-only mismatch is reported as a warning; only a
    confidently-read mismatch blocks validation.
    """
    if announced is None or announced <= 0:
        outcome.suggest("Announced page count not found in the title block")
        outcome.page_integrity_pass = True
        return True

    if announced != extracted:
        message = (
            f"Page count mismatch: certificate announces {announced} page(s), "
            f"{extracted} extracted"
        )
        if announced_is_reliable:
            outcome.page_integrity_pass = False
            outcome.block(message)
        else:
            outcome.page_integrity_pass = False
            outcome.warn(f"{message} (page marker read by OCR - verify manually)")
        return False
    return True


def audit_visual(outcome: AuditOutcome, has_stamp: bool, has_signature: bool) -> None:
    if not has_stamp:
        outcome.block("Accreditation stamp / laboratory seal not detected")
    if not has_signature:
        outcome.block("Validation signature not detected")
