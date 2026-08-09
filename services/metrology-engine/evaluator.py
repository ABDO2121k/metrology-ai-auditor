from datetime import datetime
from typing import List

try:
    from metrology_schemas import MetrologyAuditRequest, MetrologyAuditResult, EvaluatedPoint
except ImportError:
    from schemas import MetrologyAuditRequest, MetrologyAuditResult, EvaluatedPoint

def evaluate_certificate_rules(req: MetrologyAuditRequest) -> MetrologyAuditResult:
    critical_anomalies: List[str] = []
    warnings: List[str] = []

    # 1. Safe Date Parser
    def parse_date(d_str: str) -> datetime:
        if not d_str or d_str.strip() in ("#N/A", "/", ""):
            return datetime.now()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(d_str.strip(), fmt)
            except ValueError:
                pass
        return datetime.now()

    calib_date = parse_date(req.calibration_date_str)
    standard_expiry = parse_date(req.standard_expiry_date_str)
    issue_date = parse_date(req.issue_date_str)

    # 2. Rule 1: Reference Standard Validity Check (CRITICAL BLOCKER)
    is_standard_valid = calib_date <= standard_expiry
    if not is_standard_valid:
        critical_anomalies.append(
            f"CRITICAL BLOCKER: Reference standard expired on {req.standard_expiry_date_str}, "
            f"but calibration was performed on {req.calibration_date_str}."
        )

    # 3. Rule 2: Chronological Timeline Check
    is_chronology_valid = calib_date <= issue_date
    if req.next_calibration_date_str and req.next_calibration_date_str.strip() not in ("#N/A", "/", ""):
        next_calib_date = parse_date(req.next_calibration_date_str)
        if not (issue_date <= next_calib_date):
            is_chronology_valid = False
            critical_anomalies.append(
                f"CHRONOLOGY ERROR: Issue date ({req.issue_date_str}) is after next calibration date ({req.next_calibration_date_str})."
            )

    if calib_date > issue_date:
        critical_anomalies.append(
            f"CHRONOLOGY ERROR: Calibration date ({req.calibration_date_str}) is after issue date ({req.issue_date_str})."
        )

    # 4. Rule 3: Page Count & Document Integrity Check
    is_page_count_valid = req.announced_page_count == req.actual_extracted_pages
    if not is_page_count_valid:
        critical_anomalies.append(
            f"DOCUMENT INTEGRITY ERROR: Certificate header announces {req.announced_page_count} pages, "
            f"but {req.actual_extracted_pages} pages were extracted."
        )

    # 5. Stamp & Signature Verification
    has_required_signatures = req.has_stamp_logo and req.has_signature
    if not req.has_stamp_logo:
        warnings.append("STAMP WARNING: Official laboratory accreditation stamp or logo missing.")
    if not req.has_signature:
        warnings.append("SIGNATURE WARNING: Technical validator signature unverified or missing.")

    # 6. Rule 4: Environmental Operational Range Check (23°C ± 2°C, Humidity ≤ 80%)
    is_temp_ok = 21.0 <= req.temp_celsius <= 25.0
    is_humidity_ok = req.humidity_percent <= 80.0
    is_environment_valid = is_temp_ok and is_humidity_ok

    if not is_temp_ok:
        warnings.append(f"AMBIENT TEMP WARNING: {req.temp_celsius}°C is outside optimal operational limits (21.0°C - 25.0°C).")
    if not is_humidity_ok:
        warnings.append(f"HUMIDITY WARNING: {req.humidity_percent}% exceeds maximum threshold (≤ 80% RH).")

    # 7. Measurement Point Guard-Band & Hysteresis Evaluation (|Correction| + U <= EMT)
    evaluated_points: List[EvaluatedPoint] = []
    all_points_conforme = True
    conforme_count = 0
    non_conforme_count = 0

    for pt in req.measurements:
        calc_error = abs(pt.measured_value - pt.reference_value)
        calc_correction = pt.reference_value - pt.measured_value
        guard_band_sum = abs(calc_correction) + pt.uncertainty_u
        point_conforme = guard_band_sum <= pt.emt

        if point_conforme:
            conforme_count += 1
        else:
            non_conforme_count += 1
            all_points_conforme = False
            critical_anomalies.append(
                f"POINT #{pt.point_index} [{pt.grandeur}]: |Correction| ({abs(calc_correction):.4f} {pt.unit}) + "
                f"U ({pt.uncertainty_u:.4f} {pt.unit}) = {guard_band_sum:.4f} exceeds EMT limit ({pt.emt:.4f} {pt.unit})."
            )

        is_hysteresis_ok = True
        if pt.is_return_point:
            h_delta = abs(calc_correction - pt.aller_correction)
            if h_delta > (pt.emt * 0.5):
                is_hysteresis_ok = False
                warnings.append(
                    f"HYSTERESIS WARNING: Point #{pt.point_index} [{pt.grandeur}] return cycle delta ({h_delta:.4f} {pt.unit}) "
                    f"exceeds tolerance threshold ({pt.emt * 0.5:.4f} {pt.unit})."
                )

        evaluated_points.append(
            EvaluatedPoint(
                point_index=pt.point_index,
                grandeur=pt.grandeur,
                unit=pt.unit,
                nominal=pt.nominal_value,
                reference=pt.reference_value,
                measured=pt.measured_value,
                calculated_error=round(calc_error, 4),
                calculated_correction=round(calc_correction, 4),
                guard_band_sum=round(guard_band_sum, 4),
                emt_limit=pt.emt,
                is_conforme=point_conforme,
                is_hysteresis_ok=is_hysteresis_ok
            )
        )

    # 8. Determine Overall Certificate Status
    if critical_anomalies:
        overall_status = "CRITICAL_REJECT"
    elif warnings or not all_points_conforme:
        overall_status = "WARNING"
    else:
        overall_status = "PASSED"

    return MetrologyAuditResult(
        certificate_id=req.certificate_id,
        certificate_number=req.certificate_number,
        overall_status=overall_status,
        is_standard_valid=is_standard_valid,
        is_chronology_valid=is_chronology_valid,
        is_environment_valid=is_environment_valid,
        is_page_count_valid=is_page_count_valid,
        has_required_signatures=has_required_signatures,
        all_points_conforme=all_points_conforme,
        total_points_evaluated=len(req.measurements),
        conforme_points_count=conforme_count,
        non_conforme_points_count=non_conforme_count,
        critical_anomalies=critical_anomalies,
        warnings=warnings,
        evaluated_points=evaluated_points
    )

