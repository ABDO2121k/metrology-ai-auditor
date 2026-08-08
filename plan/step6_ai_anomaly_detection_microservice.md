# Step 6: AI Anomaly & Fraud Detection Microservice (`ai-anomaly`)

## 1. Objective & Scope

Design and deploy the **AI Anomaly & Fraud Detection Microservice** (`ai-anomaly`) using **Python (FastAPI)**, **LightGBM**, and **Isolation Forest** compiled to **ONNX Runtime**.

This service processes extracted certificate metrics and metrological rule results to detect subtle anomalies, typographical input errors, statistical measurement drift, missing administrative stamps/logos, and fraud indicators with sub-15ms inference latency.

---

## 2. Machine Learning Architecture & Features

The model receives a 12-dimensional feature vector $\mathbf{X}$ computed from OCR extraction and rule engine outputs:

$$\mathbf{X} = \begin{bmatrix} 
x_1: \text{Ambient Temperature } (^\circ\text{C}) \\ 
x_2: \text{Relative Humidity } (\%) \\ 
x_3: \text{Standard Days Until Expiry} \\ 
x_4: \text{Max Measurement Error} \\ 
x_5: \text{Max Correction} \\ 
x_6: \text{Max Uncertainty } U \\ 
x_7: \text{Guard Band Ratio } \max\left(\frac{|\text{Correction}| + U}{\text{EMT}}\right) \\ 
x_8: \text{Hysteresis Max Delta } \Delta \\ 
x_9: \text{Has Laboratory Stamp/Seal } (0/1) \\ 
x_{10}: \text{Has Valid Signature } (0/1) \\ 
x_{11}: \text{Page Discrepancy } (\text{Announced} - \text{Actual}) \\ 
x_{12}: \text{Total Measurement Points Count} 
\end{bmatrix}$$

---

## 3. Microservice Project Layout (`app/services/ai-anomaly/`)

```
ai-anomaly/
├── main.py
├── requirements.txt
├── Dockerfile
├── models/
│   ├── isolation_forest.onnx
│   └── lightgbm_classifier.onnx
├── ml_engine/
│   ├── feature_extractor.py
│   ├── onnx_predictor.py
│   └── anomaly_classifier.py
└── schemas/
    └── anomaly_response_schema.py
```

---

## 4. Implementation Details (`ml_engine/onnx_predictor.py`)

```python
import numpy as np
import onnxruntime as ort
from pydantic import BaseModel
from typing import List, Dict, Any

class AnomalyPredictionRequest(BaseModel):
    certificate_id: str
    temp_celsius: float
    humidity_percent: float
    standard_days_to_expiry: int
    max_error: float
    max_correction: float
    max_uncertainty_u: float
    max_emt_ratio: float
    hysteresis_max_delta: float
    has_stamp_logo: bool
    has_signature: bool
    page_discrepancy: int
    total_points: int

class AnomalyPredictionResponse(BaseModel):
    certificate_id: str
    anomaly_score: float
    confidence_score: float
    recommendation: str  # "APPROVE", "REJECT", "MANUAL_REVIEW_REQUIRED"
    detected_flags: List[Dict[str, Any]]

class ONNXAnomalyModel:
    def __init__(self, model_path: str):
        # ONNX Runtime optimized CPU inference backend
        self.session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
        self.input_name = self.session.get_inputs()[0].name

    def predict(self, features: List[float]) -> float:
        input_data = np.array([features], dtype=np.float32)
        outputs = self.session.run(None, {self.input_name: input_data})
        # Score ranges from 0.0 (Normal) to 1.0 (Highly Anomalous)
        raw_score = float(outputs[0][0])
        return min(max(raw_score, 0.0), 1.0)

# Instantiate Predictor
model = ONNXAnomalyModel("models/isolation_forest.onnx")

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

    anomaly_score = model.predict(features)
    flags = []

    # Rule & Feature Specific Heuristic Flags
    if not req.has_signature:
        flags.append({"type": "MISSING_SIGNATURE", "severity": "CRITICAL", "message": "Validation signature absent."})
        anomaly_score = max(anomaly_score, 0.85)

    if not req.has_stamp_logo:
        flags.append({"type": "MISSING_STAMP", "severity": "CRITICAL", "message": "SOAC/WAAS accreditation seal absent."})
        anomaly_score = max(anomaly_score, 0.85)

    if req.page_discrepancy != 0:
        flags.append({"type": "PAGE_COUNT_MISMATCH", "severity": "CRITICAL", "message": f"Document page count discrepancy ({req.page_discrepancy})."})
        anomaly_score = max(anomaly_score, 0.90)

    if req.max_emt_ratio > 1.0:
        flags.append({"type": "EMT_LIMIT_EXCEEDED", "severity": "CRITICAL", "message": "Measurement exceeds Maximum Permissible Error (EMT)."})
        anomaly_score = max(anomaly_score, 0.95)

    if req.standard_days_to_expiry < 0:
        flags.append({"type": "EXPIRED_STANDARD", "severity": "CRITICAL", "message": "Reference standard was expired at calibration time."})
        anomaly_score = 1.0

    # Decision Matrix
    if anomaly_score >= 0.80:
        recommendation = "REJECT"
    elif anomaly_score >= 0.40:
        recommendation = "MANUAL_REVIEW_REQUIRED"
    else:
        recommendation = "APPROVE"

    confidence = round((1.0 - abs(anomaly_score - 0.5) * 2) * 100, 2)
    confidence_score = max(confidence, 85.0)

    return AnomalyPredictionResponse(
        certificate_id=req.certificate_id,
        anomaly_score=round(anomaly_score, 4),
        confidence_score=confidence_score,
        recommendation=recommendation,
        detected_flags=flags
    )
```

---

## 5. Decision & Recommendation Matrix

| Anomaly Score Interval | Flag Classification | System Action | Required Human Role |
| :--- | :--- | :--- | :--- |
| **$0.00 \le \text{Score} < 0.40$** | `LOW_RISK` | Auto-mark as `READY_FOR_SIGNATURE` | Validator (1-click approval) |
| **$0.40 \le \text{Score} < 0.80$** | `WARNING_ANOMALY` | Highlight specific table fields & warnings | Validator (Manual review required) |
| **$0.80 \le \text{Score} \le 1.00$** | `CRITICAL_BLOCKING` | Lock certificate validation & reject | Admin / Technical Director |

---

## 6. Verification Checklist

- [ ] Run benchmark tests: Ensure 1,000 predictions take **<1.5 seconds total** (<1.5ms per request).
- [ ] Test feature sensitivity: Pass `has_signature=False`. Confirm anomaly score jumps to $\ge 0.85$ and recommendation returns `REJECT`.
- [ ] Test ONNX model artifact compatibility with `onnxruntime` v1.17+.
