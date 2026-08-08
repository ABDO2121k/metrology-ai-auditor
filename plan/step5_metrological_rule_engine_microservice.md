# Step 5: Metrological Rule Engine Microservice (`metrology-engine`)

## 1. Objective & Scope

Design and build the **Metrological Rule Engine Microservice** (`metrology-engine`).

This microservice acts as the core compliance auditor of the platform. It systematically re-evaluates all raw calibration measurements, reference standards, environmental conditions, and decision rules against **ISO/IEC 17025:2017**, **PR.ECE V9**, and **PRO.MDD V23** standards.

---

## 2. Metrological Rules & Mathematical Formulas

### Rule 1: Reference Standard Validity Check (CRITICAL BLOCKER)
The reference standard used during calibration must be under active validity at the time of intervention:
$$\text{Status} = \begin{cases} \text{PASSED}, & \text{Date\_Étalonnage} \le \text{Date\_Validité\_Étalon} \\ \text{CRITICAL\_BLOCKING\_ANOMALY}, & \text{Date\_Étalonnage} > \text{Date\_Validité\_Étalon} \end{cases}$$

### Rule 2: Chronological Sequence Check
$$\text{Date\_Étalonnage} \le \text{Date\_Émission} \le \text{Date\_Validation} < \text{Date\_Prochain\_Étalonnage}$$

### Rule 3: Error & Correction Mathematical Verification
$$\text{Erreur}_{\text{Calculée}} = |\text{Valeur}_{\text{Mesurée}} - \text{Valeur}_{\text{Référence}}|$$
$$\text{Correction}_{\text{Calculée}} = \text{Valeur}_{\text{Référence}} - \text{Valeur}_{\text{Mesurée}}$$

### Rule 4: Hysteresis / Return Cycle Delta Check
$$\Delta_{\text{Hystérèse}} = |\text{Correction}_{\text{Retour}} - \text{Correction}_{\text{Aller}}| \le \text{Seuil}_{\text{Toléré}}$$

### Rule 5: ISO 17025 Conformity & Guard Band Decision Rule
$$\text{Is\_Conforme} \iff |\text{Correction}| + U \le \text{EMT}$$
Where:
- $U$: Expanded Uncertainty ($k=2$, 95% level of confidence)
- $\text{EMT}$: Maximum Permissible Error (Erreur Maximale Tolérée)

---

## 3. Microservice Project Layout (`app/services/metrology-engine/`)

```
metrology-engine/
├── main.py
├── requirements.txt
├── Dockerfile
├── engine/
│   ├── standard_validator.py
│   ├── math_recalculator.py
│   ├── hysteresis_checker.py
│   ├── environmental_checker.py
│   └── decision_rule_evaluator.py
├── schemas/
│   └── validation_result_schema.py
└── tests/
    └── test_metrology_rules.py
```

---

## 4. Implementation Details (`engine/decision_rule_evaluator.py`)

```python
from datetime import datetime
from typing import List, Dict, Any
from pydantic import BaseModel

class MeasurementPointInput(BaseModel):
    point_index: int
    nominal_value: float
    reference_value: float
    measured_value: float
    uncertainty_u: float
    emt: float
    is_return_point: bool = False
    aller_correction: float = 0.0

class MetrologyAuditResult(BaseModel):
    certificate_id: str
    is_standard_valid: bool
    is_chronology_valid: bool
    is_environment_valid: bool
    all_points_conforme: bool
    critical_anomalies: List[str]
    warnings: List[str]
    evaluated_points: List[Dict[str, Any]]

def evaluate_metrology_rules(
    certificate_id: str,
    calibration_date_str: str,
    standard_expiry_date_str: str,
    issue_date_str: str,
    next_calibration_date_str: str,
    temp_celsius: float,
    humidity_percent: float,
    measurements: List[MeasurementPointInput]
) -> MetrologyAuditResult:

    critical_anomalies = []
    warnings = []

    # 1. Parse Dates
    calib_date = datetime.strptime(calibration_date_str, "%Y-%m-%d")
    standard_expiry = datetime.strptime(standard_expiry_date_str, "%Y-%m-%d")
    issue_date = datetime.strptime(issue_date_str, "%Y-%m-%d")
    next_calib_date = datetime.strptime(next_calibration_date_str, "%Y-%m-%d")

    # 2. Rule 1: Reference Standard Expiry Check
    is_standard_valid = calib_date <= standard_expiry
    if not is_standard_valid:
        critical_anomalies.append(
            f"CRITICAL BLOCKER: Reference standard expired on {standard_expiry_date_str}, "
            f"but calibration was performed on {calibration_date_str}."
        )

    # 3. Rule 2: Chronology Check
    is_chronology_valid = calib_date <= issue_date < next_calib_date
    if not is_chronology_valid:
        critical_anomalies.append(
            f"CHRONOLOGY ERROR: Calibration date ({calibration_date_str}) or Issue date ({issue_date_str}) "
            f"violates sequence timeline."
        )

    # 4. Environmental Range Check (23°C ± 2°C, Humidity ≤ 80%)
    is_temp_ok = 21.0 <= temp_celsius <= 25.0
    is_humidity_ok = humidity_percent <= 80.0
    is_environment_valid = is_temp_ok and is_humidity_ok

    if not is_temp_ok:
        warnings.append(f"Environmental Temperature out of optimal range: {temp_celsius}°C (Expected 23°C ± 2°C)")
    if not is_humidity_ok:
        warnings.append(f"Relative Humidity exceeded threshold: {humidity_percent}% (Expected ≤ 80%)")

    # 5. Evaluate Points, Recalculate Errors & Decision Rule
    evaluated_points = []
    all_points_conforme = True

    for pt in measurements:
        calc_error = abs(pt.measured_value - pt.reference_value)
        calc_correction = pt.reference_value - pt.measured_value
        
        # Decision Rule: |Correction| + U <= EMT
        guard_band_sum = abs(calc_correction) + pt.uncertainty_u
        point_conforme = guard_band_sum <= pt.emt

        if not point_conforme:
            all_points_conforme = False
            critical_anomalies.append(
                f"POINT {pt.point_index} NON-CONFORME: |Correction| ({abs(calc_correction):.4f}) + U ({pt.uncertainty_u:.4f}) "
                f"= {guard_band_sum:.4f} exceeds EMT ({pt.emt:.4f})"
            )

        # Hysteresis Check for Return Points
        hysteresis_delta = 0.0
        is_hysteresis_ok = True
        if pt.is_return_point:
            hysteresis_delta = abs(calc_correction - pt.aller_correction)
            if hysteresis_delta > (pt.emt * 0.5):
                is_hysteresis_ok = False
                warnings.append(f"Point {pt.point_index} exhibits high hysteresis delta: {hysteresis_delta:.4f}")

        evaluated_points.append({
            "point_index": pt.point_index,
            "nominal": pt.nominal_value,
            "reference": pt.reference_value,
            "measured": pt.measured_value,
            "calculated_error": round(calc_error, 4),
            "calculated_correction": round(calc_correction, 4),
            "guard_band_sum": round(guard_band_sum, 4),
            "emt_limit": pt.emt,
            "is_conforme": point_conforme,
            "is_hysteresis_ok": is_hysteresis_ok
        })

    return MetrologyAuditResult(
        certificate_id=certificate_id,
        is_standard_valid=is_standard_valid,
        is_chronology_valid=is_chronology_valid,
        is_environment_valid=is_environment_valid,
        all_points_conforme=all_points_conforme,
        critical_anomalies=critical_anomalies,
        warnings=warnings,
        evaluated_points=evaluated_points
    )
```

---

## 5. Verification Checklist

- [ ] Execute unit tests in `tests/test_metrology_rules.py` covering:
  - Expired reference standard (Verify critical blocker triggered).
  - $|\text{Correction}| + U \le \text{EMT}$ boundary condition (e.g. $1.03 + 0.58 = 1.61 \le 2.0 \implies \text{Conforme}$).
  - Out of boundary condition (e.g. $1.60 + 0.50 = 2.10 > 2.0 \implies \text{Non-Conforme}$).
  - Environmental humidity $>80\%$ (Verify warning triggered).
- [ ] Confirm sub-millisecond calculation response time (<5ms for 100 measurement points).
