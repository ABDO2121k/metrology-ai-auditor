from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class OCRParseRequest(BaseModel):
    certificate_id: str
    file_bytes_path: Optional[str] = None
    s3_path: Optional[str] = None
    # Force a full re-extraction even when a cached result exists upstream.
    force_refresh: bool = False


class MeasurementRow(BaseModel):
    point_index: int
    parameter: Optional[str] = None
    nominal_value: float
    reference_value: float
    measured_value: float
    unit: str
    # Value printed on the certificate (may differ from the recomputed one).
    recorded_error: Optional[float] = None
    calculated_error: float
    calculated_correction: float
    uncertainty_u: float
    emt_limit: float
    guard_band_sum: float = 0.0
    is_return_point: bool = False
    hysteresis_delta: Optional[float] = None
    is_hysteresis_valid: bool = True
    math_check_pass: bool = True
    is_conforme: bool = True


class FieldProvenance(BaseModel):
    """Where a single extracted field came from, and how much we trust it."""
    field: str
    value: Optional[str] = None
    source: str = "NONE"  # VISION, TEXT_LAYER, LOCAL_OCR, REGEX, DERIVED, NONE
    confidence: float = 0.0
    agreement: Optional[bool] = None  # vision and local OCR agreed


class AIValidationResult(BaseModel):
    confidence_score: float  # 0.0 to 1.0
    data_quality_score: float  # 0.0 to 1.0
    measurement_validity_score: float  # 0.0 to 1.0
    extraction_quality: str = "HIGH"  # EXCELLENT, HIGH, MEDIUM, POOR, FAILED
    critical_issues: List[str] = []
    warnings: List[str] = []
    suggestions: List[str] = []
    validation_passed: bool
    validation_timestamp: str


class DocumentInfo(BaseModel):
    certificate_number: str
    form_code: Optional[str] = None
    domain: str  # ELECTRICITY-MAGNETISM, ROTATION-SPEED, TIMING, THERMAL, PRESSURE, MASS, DIMENSIONAL, UNKNOWN
    is_amendment: bool = False
    superseded_certificate: Optional[str] = None
    is_new_template_detected: bool = False
    announced_pages: int
    extracted_pages: int
    page_integrity_pass: bool


class ClientAndDevice(BaseModel):
    client_name: str
    client_address: Optional[str] = None
    device_designation: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: str
    internal_code: Optional[str] = None


class DatesAndConditions(BaseModel):
    calibration_date: Optional[str] = None
    issue_date: Optional[str] = None
    validation_date: Optional[str] = None
    next_calibration_date: Optional[str] = None
    chronology_valid: bool = True
    chronology_issues: List[str] = []
    ambient_temperature: Optional[str] = None
    ambient_humidity: Optional[str] = None
    temperature_celsius: Optional[float] = None
    humidity_percent: Optional[float] = None
    conditions_valid: bool = True


class ReferenceStandardAuditItem(BaseModel):
    designation: str
    connection_code: Optional[str] = None
    validity_date: Optional[str] = None
    is_valid_at_calibration: bool = True


class VisualValidation(BaseModel):
    lab_logo_present: bool = True
    accreditation_logo_present: bool = True
    validation_stamp_present: bool = True
    signatures_present: bool = True
    operator_name: Optional[str] = None
    approver_name: Optional[str] = None


class MetrologicalAuditSummary(BaseModel):
    total_points_tested: int = 0
    math_errors_detected: int = 0
    non_conforme_points: int = 0
    hysteresis_failures: int = 0
    conformity_status: str = "CONFORME"
    parameters_audited: List[str] = []


class AIDecision(BaseModel):
    overall_status: str = "COMPLETED"
    validation_recommendation: str = "VALIDATED"
    confidence_score: float = 0.0
    blocking_anomalies: List[str] = []
    warnings: List[str] = []


class ExtractionDiagnostics(BaseModel):
    """Everything needed to explain *why* an extraction turned out the way it did."""
    engine_pipeline: List[str] = []  # e.g. ["TEXT_LAYER", "LOCAL_OCR", "VISION"]
    vision_model: Optional[str] = None
    vision_used: bool = False
    vision_error: Optional[str] = None
    local_ocr_used: bool = False
    local_ocr_error: Optional[str] = None
    text_layer_chars: int = 0
    ocr_chars: int = 0
    ocr_mean_confidence: Optional[float] = None
    pages_rendered: int = 0
    render_max_side: int = 0
    render_bytes_total: int = 0
    duration_ms: int = 0
    field_provenance: List[FieldProvenance] = []
    disagreements: List[str] = []


class UniversalAuditPayload(BaseModel):
    document_info: DocumentInfo
    client_and_device: ClientAndDevice
    dates_and_conditions: DatesAndConditions
    reference_standards_audit: List[ReferenceStandardAuditItem] = []
    visual_validation: VisualValidation
    metrological_audit: MetrologicalAuditSummary
    ai_decision: AIDecision


class ExtractedCertificateData(BaseModel):
    certificate_id: str
    certificate_number: str
    client_name: str
    instrument_name: str
    instrument_serial: str
    announced_page_count: int
    actual_extracted_pages: int
    issue_date: Optional[str] = None
    calibration_date: Optional[str] = None
    next_calibration_date: Optional[str] = None
    ambient_temperature: Optional[str] = None
    ambient_humidity: Optional[str] = None
    reference_standard_code: Optional[str] = None
    reference_standard_expiry: Optional[str] = None
    has_stamp_logo: bool = True
    has_signature: bool = True
    measurements: List[MeasurementRow] = []
    ai_validation: Optional[AIValidationResult] = None
    universal_payload: Optional[UniversalAuditPayload] = None
    diagnostics: Optional[ExtractionDiagnostics] = None
    raw_text: Optional[str] = None
    is_mocked: bool = False
