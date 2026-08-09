import os
import sys
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException

# Add current directory and ml_engine to sys.path
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "ml_engine"))

from schemas import AnomalyPredictionRequest, AnomalyPredictionResponse
from ml_engine.onnx_predictor import analyze_certificate_anomalies

app = FastAPI(
    title="Process Instruments AI Anomaly & Fraud Detection Microservice",
    version="1.0.0",
    description="ONNX Runtime powered Machine Learning Anomaly Detection for Calibration Certificates"
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ai-anomaly",
        "backend": "ONNX Runtime CPU / Statistical Classifier"
    }

@app.post("/api/v1/anomaly/predict", response_model=AnomalyPredictionResponse)
def predict_anomaly(req: AnomalyPredictionRequest):
    try:
        return analyze_certificate_anomalies(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/anomaly/predict-5certs")
def evaluate_5_certificate_models():
    """
    Evaluates AI anomaly detection on the 5 calibration certificate models.
    """
    demo_models = [
        # Certif 1: Resistor Box (Perfect Clean)
        AnomalyPredictionRequest(
            certificate_id="cert-1-resistor",
            certificate_number="ARRM13388-26",
            temp_celsius=23.0,
            humidity_percent=50.0,
            standard_days_to_expiry=378,
            max_error=0.0134,
            max_correction=-0.0134,
            max_uncertainty_u=0.0082,
            max_emt_ratio=0.432,
            hysteresis_max_delta=0.0,
            has_stamp_logo=True,
            has_signature=True,
            page_discrepancy=0,
            total_points=2
        ),
        # Certif 2: Temperature Sensor (Normal Clean)
        AnomalyPredictionRequest(
            certificate_id="cert-2-temp",
            certificate_number="AETE04897-26",
            temp_celsius=22.5,
            humidity_percent=52.0,
            standard_days_to_expiry=365,
            max_error=0.08,
            max_correction=-0.08,
            max_uncertainty_u=0.06,
            max_emt_ratio=0.70,
            hysteresis_max_delta=0.01,
            has_stamp_logo=True,
            has_signature=True,
            page_discrepancy=0,
            total_points=4
        ),
        # Certif 3: Multimeter (Clean)
        AnomalyPredictionRequest(
            certificate_id="cert-3-multimeter",
            certificate_number="ARTL05391-26/A",
            temp_celsius=23.2,
            humidity_percent=48.0,
            standard_days_to_expiry=350,
            max_error=0.0002,
            max_correction=-0.0002,
            max_uncertainty_u=0.0005,
            max_emt_ratio=0.14,
            hysteresis_max_delta=0.0,
            has_stamp_logo=True,
            has_signature=True,
            page_discrepancy=0,
            total_points=3
        ),
        # Certif 4: Shunt (Clean)
        AnomalyPredictionRequest(
            certificate_id="cert-4-shunt",
            certificate_number="ARBI13361-26",
            temp_celsius=24.0,
            humidity_percent=55.0,
            standard_days_to_expiry=365,
            max_error=0.008,
            max_correction=-0.008,
            max_uncertainty_u=0.012,
            max_emt_ratio=0.40,
            hysteresis_max_delta=0.0,
            has_stamp_logo=True,
            has_signature=True,
            page_discrepancy=0,
            total_points=2
        ),
        # Certif 5: Process Calibrator (Anomalous Test Case: Missing signature & page mismatch)
        AnomalyPredictionRequest(
            certificate_id="cert-5-calibrator-anomaly-test",
            certificate_number="AENS12791-26",
            temp_celsius=23.0,
            humidity_percent=50.0,
            standard_days_to_expiry=365,
            max_error=0.0003,
            max_correction=-0.0003,
            max_uncertainty_u=0.0008,
            max_emt_ratio=0.22,
            hysteresis_max_delta=0.0,
            has_stamp_logo=True,
            has_signature=False,  # Missing signature!
            page_discrepancy=1,   # Page mismatch!
            total_points=6
        )
    ]

    results = {}
    for req in demo_models:
        pred = analyze_certificate_anomalies(req)
        results[req.certificate_number] = {
            "certificate_id": pred.certificate_id,
            "anomaly_score": pred.anomaly_score,
            "confidence_score": pred.confidence_score,
            "recommendation": pred.recommendation,
            "flags_count": len(pred.detected_flags),
            "detected_flags": [f.model_dump() for f in pred.detected_flags]
        }

    return {
        "status": "success",
        "models_evaluated": len(results),
        "evaluation_matrix": results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
