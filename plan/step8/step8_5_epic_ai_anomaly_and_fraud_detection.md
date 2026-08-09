# EPIC 5: AI Anomaly & Fraud Detection Risk Panel

## 1. Executive Summary & Vision

This Epic specifies the **AI Anomaly & Fraud Risk Panel**, connected directly to **`ai-anomaly`** (Port 8004) executing an ONNX Machine Learning Inference Session (`onnxruntime` v1.28.0).

Per the project specification, the AI model processes a 12-dimensional feature vector $\mathbf{X}$ to score anomaly probability ($0.0 \to 1.0$) and detect falsification or human errors.

---

## 2. Backend Implementation Status & Detected Flags

> [!NOTE]
> **Backend Implementation Status**:
> - **`ai-anomaly`** (Port 8004) is **100% IMPLEMENTED and LIVE** in Docker (`onnxruntime` v1.28.0 CPU backend).

| Flag Key | Severity | Cause & Condition | Frontend UI Visual Presentation |
| :--- | :--- | :--- | :--- |
| `MISSING_SIGNATURE` | **CRITICAL** | Validation signature absent on PDF | Red Glowing Alert Box + Warning Banner |
| `MISSING_STAMP` | **CRITICAL** | Laboratory / Accreditation seal missing | Red Glowing Alert Box + Warning Banner |
| `PAGE_COUNT_MISMATCH` | **CRITICAL** | Announced pages $\neq$ actual pages | Amber Warning Badge |
| `EXPIRED_STANDARD` | **CRITICAL** | Reference standard expired before calib date | Red Alert Box |
| `EMT_LIMIT_EXCEEDED` | **HIGH** | Guard band ratio $\max\left(\frac{|\text{Corr}|+U}{\text{EMT}}\right) > 1.0$ | Red Highlighted Row |

---

## 3. UI Components List

1. **`AiRiskScoreGaugeComponent`**: Visual anomaly score progress meter (0% to 100%).
2. **`AiRecommendationBadgeComponent`**: Recommendation indicator (`APPROVE`, `MANUAL_REVIEW_REQUIRED`, `REJECT`).
3. **`DetectedFlagsAccordionComponent`**: Expandable breakdown of detected anomaly flags with severity level and description.
