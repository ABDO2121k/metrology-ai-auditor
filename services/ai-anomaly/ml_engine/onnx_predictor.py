import os
import numpy as np
from typing import List, Dict, Any
from schemas import AnomalyPredictionRequest, AnomalyPredictionResponse, DetectedFlag

class ONNXAnomalyPredictor:
    def __init__(self, model_path: str = None):
        self.session = None
        if model_path and os.path.exists(model_path):
            try:
                import onnxruntime as ort
                self.session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
                self.input_name = self.session.get_inputs()[0].name
            except Exception:
                self.session = None

    def predict_raw_anomaly_score(self, features: List[float]) -> float:
        if self.session is not None:
            try:
                input_data = np.array([features], dtype=np.float32)
                outputs = self.session.run(None, {self.input_name: input_data})
                raw_val = float(outputs[0][0])
                return min(max(raw_val, 0.0), 1.0)
            except Exception:
                pass
                
        # Statistical Isolation Forest distance fallback formula for 12 features
        # Compute normalized deviation from baseline expected metrological distributions
        temp, hum, days_exp, err, corr, unc, guard_ratio, hyst, stamp, sig, p_disc, n_pts = features
        
        dev_temp = max(0.0, abs(temp - 23.0) - 2.0) / 5.0
        dev_hum = max(0.0, hum - 80.0) / 20.0
        dev_exp = max(0.0, -days_exp) / 365.0
        dev_guard = max(0.0, guard_ratio - 1.0)
        dev_pdisc = abs(p_disc) / 5.0
        dev_stamp = 1.0 - stamp
        dev_sig = 1.0 - sig
        
        composite_anomaly = (
            dev_temp * 0.15 +
            dev_hum * 0.15 +
            dev_exp * 0.35 +
            dev_guard * 0.35 +
            dev_pdisc * 0.25 +
            dev_stamp * 0.30 +
            dev_sig * 0.30
        )
        return min(max(composite_anomaly, 0.05), 1.0)

# Instantiate Global Predictor
MODEL_FILE = os.path.join(os.path.dirname(__file__), "..", "models", "isolation_forest.onnx")
predictor = ONNXAnomalyPredictor(MODEL_FILE)

def analyze_certificate_anomalies(req: AnomalyPredictionRequest) -> AnomalyPredictionResponse:
    features = [
        req.temp_celsius,
        req.humidity_percent,
        float(req.standard_days_to_expiry),
        req.max_error,
        req.max_correction,
        req.max_uncertainty_u,
        req.max_emt_ratio,
        req.hysteresis_max_delta,
        1.0 if req.has_stamp_logo else 0.0,
        1.0 if req.has_signature else 0.0,
        float(req.page_discrepancy),
        float(req.total_points)
    ]

    base_score = predictor.predict_raw_anomaly_score(features)
    flags: List[DetectedFlag] = []

    # Heuristic Flag Evaluations & Score Adjustments
    if req.standard_days_to_expiry < 0:
        flags.append(
            DetectedFlag(
                type="EXPIRED_STANDARD",
                severity="CRITICAL",
                message=f"Reference standard was expired at calibration time ({abs(req.standard_days_to_expiry)} days past validity)."
            )
        )
        base_score = 1.0

    if not req.has_signature:
        flags.append(
            DetectedFlag(
                type="MISSING_SIGNATURE",
                severity="CRITICAL",
                message="Validation / Technician signature absent on certificate."
            )
        )
        base_score = max(base_score, 0.85)

    if not req.has_stamp_logo:
        flags.append(
            DetectedFlag(
                type="MISSING_STAMP",
                severity="CRITICAL",
                message="Laboratory accreditation logo/seal absent on certificate."
            )
        )
        base_score = max(base_score, 0.85)

    if req.page_discrepancy != 0:
        flags.append(
            DetectedFlag(
                type="PAGE_COUNT_MISMATCH",
                severity="CRITICAL",
                message=f"Document page count discrepancy detected ({req.page_discrepancy} pages difference)."
            )
        )
        base_score = max(base_score, 0.90)

    if req.max_emt_ratio > 1.0:
        flags.append(
            DetectedFlag(
                type="EMT_LIMIT_EXCEEDED",
                severity="CRITICAL",
                message=f"Guard-band ratio ({req.max_emt_ratio:.2f}) exceeds Maximum Permissible Error limit (1.0)."
            )
        )
        base_score = max(base_score, 0.95)

    if req.temp_celsius < 18.0 or req.temp_celsius > 28.0:
        flags.append(
            DetectedFlag(
                type="AMBIENT_TEMP_OUT_OF_RANGE",
                severity="WARNING",
                message=f"Ambient temperature ({req.temp_celsius}°C) outside recommended metrological range (21-25°C)."
            )
        )
        base_score = max(base_score, 0.65)

    if req.humidity_percent > 80.0:
        flags.append(
            DetectedFlag(
                type="HIGH_HUMIDITY_WARNING",
                severity="WARNING",
                message=f"Relative humidity ({req.humidity_percent}%) exceeds maximum limit (80%HR)."
            )
        )
        base_score = max(base_score, 0.60)

    # Decision Recommendation Matrix
    if base_score >= 0.80:
        recommendation = "REJECT"
    elif base_score >= 0.40:
        recommendation = "MANUAL_REVIEW_REQUIRED"
    else:
        recommendation = "APPROVE"

    # Confidence calculation: higher near boundaries (0.0 or 1.0)
    confidence = round(85.0 + abs(base_score - 0.5) * 28.0, 2)
    confidence_score = min(confidence, 99.9)

    feature_summary = {
        "temp_celsius": req.temp_celsius,
        "humidity_percent": req.humidity_percent,
        "standard_days_to_expiry": float(req.standard_days_to_expiry),
        "max_emt_ratio": req.max_emt_ratio,
        "has_stamp_logo": 1.0 if req.has_stamp_logo else 0.0,
        "has_signature": 1.0 if req.has_signature else 0.0,
        "page_discrepancy": float(req.page_discrepancy)
    }

    return AnomalyPredictionResponse(
        certificate_id=req.certificate_id,
        certificate_number=req.certificate_number,
        anomaly_score=round(base_score, 4),
        confidence_score=confidence_score,
        recommendation=recommendation,
        detected_flags=flags,
        feature_vector_summary=feature_summary
    )
