from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class AnomalyPredictionRequest(BaseModel):
    certificate_id: str
    certificate_number: str = "CERT-001"
    temp_celsius: float = 23.0
    humidity_percent: float = 50.0
    standard_days_to_expiry: int = 365
    max_error: float = 0.01
    max_correction: float = -0.01
    max_uncertainty_u: float = 0.008
    max_emt_ratio: float = 0.45
    hysteresis_max_delta: float = 0.0
    has_stamp_logo: bool = True
    has_signature: bool = True
    page_discrepancy: int = 0
    total_points: int = 5

class DetectedFlag(BaseModel):
    type: str
    severity: str  # "CRITICAL", "WARNING", "INFO"
    message: str

class AnomalyPredictionResponse(BaseModel):
    certificate_id: str
    certificate_number: str
    anomaly_score: float  # 0.0 (Normal) to 1.0 (Highly Anomalous)
    confidence_score: float  # Percentage (e.g. 95.5%)
    recommendation: str  # "APPROVE", "MANUAL_REVIEW_REQUIRED", "REJECT"
    detected_flags: List[DetectedFlag]
    feature_vector_summary: Dict[str, float]
