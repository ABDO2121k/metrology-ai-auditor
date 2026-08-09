# Step 8.5: AI Anomaly & Fraud Detection Studio

## 1. Overview & Objectives

This sub-step specifies the **AI Anomaly & Fraud Risk Panel**, connected directly to the **`ai-anomaly`** microservice (Port 8004) executing an ONNX Machine Learning Inference Session (`onnxruntime` v1.28.0).

Per the project specification, the AI model processes a 12-dimensional feature vector $\mathbf{X}$ to score anomaly probability ($0.0 \to 1.0$) and detect falsification or human errors.

---

## 2. Detected Anomaly Flags Breakdown

| Flag Key | Severity | Cause & Condition | Frontend UI Visual Presentation |
| :--- | :--- | :--- | :--- |
| `MISSING_SIGNATURE` | **CRITICAL** | Validation signature absent on PDF | Glowing Red Badge + Blocking Warning |
| `MISSING_STAMP` | **CRITICAL** | Laboratory / Accreditation seal missing | Glowing Red Badge + Warning Banner |
| `PAGE_COUNT_MISMATCH` | **CRITICAL** | Announced pages $\neq$ actual pages | Amber Warning Card |
| `EXPIRED_STANDARD` | **CRITICAL** | Reference standard expired before calib date | Red Alert Box |
| `EMT_LIMIT_EXCEEDED` | **HIGH** | Guard band ratio $\max\left(\frac{|\text{Corr}|+U}{\text{EMT}}\right) > 1.0$ | Red Highlighted Row |

---

## 3. Recommendation Rules in UI

- **Score $0.00 \to 0.20$**: `APPROVE` (Green Badge) — Clean certificate.
- **Score $0.21 \to 0.60$**: `MANUAL_REVIEW_REQUIRED` (Yellow Badge) — Minor warning, requires Quality Manager review.
- **Score $0.61 \to 1.00$**: `REJECT` (Red Badge) — Severe anomaly or falsification, auto-blocking certificate validation.

---

## 4. UI Components (`src/components/ai_risk_card.tsx`)

1. **Gauge Chart / Progress Bar**:
   - Visual anomaly score meter from 0% to 100%.
2. **AI Recommendation Badge**:
   - Dynamic recommendation indicator with confidence score %.
3. **Detected Flags Accordion**:
   - Expandable list of all detected anomalies with severity level and description.
