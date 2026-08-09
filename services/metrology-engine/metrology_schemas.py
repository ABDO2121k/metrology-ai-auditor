from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class PointInput(BaseModel):
    point_index: int
    grandeur: str = "Resistance"
    unit: str = "Ω"
    nominal_value: float
    reference_value: float
    measured_value: float
    uncertainty_u: float
    emt: float
    is_return_point: bool = False
    aller_correction: float = 0.0

class MetrologyAuditRequest(BaseModel):
    certificate_id: str
    certificate_number: str = "CERT-001"
    announced_page_count: int = 2
    actual_extracted_pages: int = 2
    calibration_date_str: str
    standard_expiry_date_str: str
    issue_date_str: str
    next_calibration_date_str: str = ""
    temp_celsius: float
    humidity_percent: float
    has_stamp_logo: bool = True
    has_signature: bool = True
    measurements: List[PointInput]

class EvaluatedPoint(BaseModel):
    point_index: int
    grandeur: str
    unit: str
    nominal: float
    reference: float
    measured: float
    calculated_error: float
    calculated_correction: float
    guard_band_sum: float
    emt_limit: float
    is_conforme: bool
    is_hysteresis_ok: bool

class MetrologyAuditResult(BaseModel):
    certificate_id: str
    certificate_number: str
    overall_status: str  # "PASSED", "WARNING", "CRITICAL_REJECT"
    is_standard_valid: bool
    is_chronology_valid: bool
    is_environment_valid: bool
    is_page_count_valid: bool
    has_required_signatures: bool
    all_points_conforme: bool
    total_points_evaluated: int
    conforme_points_count: int
    non_conforme_points_count: int
    critical_anomalies: List[str]
    warnings: List[str]
    evaluated_points: List[EvaluatedPoint]
