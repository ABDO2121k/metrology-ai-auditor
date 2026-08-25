"""Run the OCR pipeline over the sample certificates and report what it found.

Usage (from app/):
    python scripts/test_all_pdfs.py [path-to-pdf ...]

With no arguments it processes the five sample certificates in the project
root. Set OPENAI_API_KEY beforehand to exercise the vision refinement layer as
well; without it the run exercises the local-only path.
"""

import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "ocr-parsing")))

import vision  # noqa: E402
from ocr_engine import extract_pdf_data, is_mock_enabled  # noqa: E402

DEFAULT_PDFS = [f"Certif {n}.pdf" for n in range(1, 6)]
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def resolve(paths):
    if paths:
        return [os.path.abspath(p) for p in paths]
    return [os.path.join(PROJECT_ROOT, name) for name in DEFAULT_PDFS]


def field(label, value, width=22):
    shown = value if value not in (None, "", []) else "— (not found)"
    return f"  {label:<{width}}: {shown}"


def main() -> int:
    targets = resolve(sys.argv[1:])

    print("=" * 74)
    print("OCR EXTRACTION PIPELINE — SAMPLE CERTIFICATE RUN")
    print("=" * 74)
    print(f"  mock mode      : {is_mock_enabled()}")
    print(f"  vision layer   : {'enabled (' + vision.VISION_MODEL + ')' if vision.is_configured() else 'disabled (set OPENAI_API_KEY)'}")
    print(f"  page workers   : {os.getenv('OCR_PAGE_WORKERS', '4')}")
    print("=" * 74)

    failures = 0

    for pdf_path in targets:
        name = os.path.basename(pdf_path)
        print(f"\n--- {name} ---")

        if not os.path.exists(pdf_path):
            print(f"  ERROR: file not found at {pdf_path}")
            failures += 1
            continue

        started = time.perf_counter()
        try:
            data = extract_pdf_data(pdf_path, f"TEST-{name}")
        except Exception as exc:
            print(f"  ERROR: {type(exc).__name__}: {exc}")
            failures += 1
            continue

        elapsed = time.perf_counter() - started
        payload = data.universal_payload
        validation = data.ai_validation
        diagnostics = data.diagnostics

        print(field("Certificate number", data.certificate_number))
        print(field("Client", data.client_name))
        print(field("Instrument", data.instrument_name))
        print(field("Serial number", data.instrument_serial))
        print(field("Domain", payload.document_info.domain if payload else None))
        print(field("Pages announced/actual", f"{data.announced_page_count} / {data.actual_extracted_pages}"))
        print(field("Calibration date", data.calibration_date))
        print(field("Issue date", data.issue_date))
        print(field("Next calibration", data.next_calibration_date))
        print(field("Ambient temperature", data.ambient_temperature))
        print(field("Ambient humidity", data.ambient_humidity))
        print(field("Reference standard", data.reference_standard_code))
        print(field("Measurement points", len(data.measurements)))

        if data.measurements:
            units = sorted({m.unit for m in data.measurements if m.unit})
            print(field("Units seen", ", ".join(units) or None))
            first = data.measurements[0]
            print(
                field(
                    "First point",
                    f"ref={first.reference_value} meas={first.measured_value} "
                    f"err={first.calculated_error} U={first.uncertainty_u} "
                    f"EMT={first.emt_limit} [{first.unit}]",
                )
            )

        if payload:
            print(field("Conformity", payload.metrological_audit.conformity_status))
            print(field("Recommendation", payload.ai_decision.validation_recommendation))

        if validation:
            print(field("Extraction quality", validation.extraction_quality))
            print(field("Confidence", f"{validation.confidence_score:.2f}"))

        if diagnostics:
            print(field("Engines", " -> ".join(diagnostics.engine_pipeline)))
            print(field("OCR confidence", diagnostics.ocr_mean_confidence))
            print(field("Render size", f"{diagnostics.render_bytes_total // 1024} KB"))
            print(field("Duration", f"{elapsed:.1f}s"))

        for issue in (validation.critical_issues if validation else []):
            print(f"    [BLOCKING] {issue}")
        for warning in (validation.warnings if validation else []):
            print(f"    [warning ] {warning}")
        for hint in (validation.suggestions if validation else []):
            print(f"    [hint    ] {hint}")

    print("\n" + "=" * 74)
    if failures:
        print(f"COMPLETED WITH {failures} FAILURE(S)")
    else:
        print("COMPLETED — all files processed")
    print("=" * 74)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
