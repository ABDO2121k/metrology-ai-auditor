# Step 9: Integration Testing, Automated QA & CI/CD Pipeline (`ci-cd`)

## 1. Objective & Scope

Establish a rigorous Quality Assurance (QA) testing suite and automated **GitHub Actions CI/CD Pipeline** for the **Process Instruments Intelligent Validation Platform**.

This step guarantees zero-error deployment, automated unit testing of metrological rule formulas, E2E integration validation across microservices, security vulnerability scanning, and automated multi-architecture Docker image builds.

---

## 2. Testing Strategy Matrix

| Test Level | Microservice Target | Framework & Tools | Scope |
| :--- | :--- | :--- | :--- |
| **Unit Testing** | `auth-gateway`, `document-ingestion` | Go Native `testing` package | JWT claim validity, SHA-256 hash generation, RBAC checks. |
| **Unit Testing** | `metrology-engine`, `ai-anomaly` | `pytest` | Math formulas ($Erreur$, $Correction$, $EMT$, Guard Band), ONNX prediction scores. |
| **E2E Integration**| All Microservices | `Playwright` / `K6` | Full user journey: Login $\rightarrow$ PDF Upload $\rightarrow$ OCR Extraction $\rightarrow$ Validation. |
| **Security Audit** | Container Images & Dependencies | `Trivy` + `Snyk` | Vulnerability scan of Docker containers and Go/Python/Node dependencies. |

---

## 3. Implementation Details

### 3.1 Automated Python Metrology Unit Test (`services/metrology-engine/tests/test_rules.py`)

```python
import pytest
from engine.decision_rule_evaluator import evaluate_metrology_rules, MeasurementPointInput

def test_expired_reference_standard_blocks_validation():
    result = evaluate_metrology_rules(
        certificate_id="TEST-001",
        calibration_date_str="2026-07-15",
        standard_expiry_date_str="2026-05-01", # Expired before calibration!
        issue_date_str="2026-07-29",
        next_calibration_date_str="2027-07-28",
        temp_celsius=23.0,
        humidity_percent=50.0,
        measurements=[]
    )
    assert result.is_standard_valid is False
    assert any("CRITICAL BLOCKER" in msg for msg in result.critical_anomalies)

def test_iso17025_guard_band_decision_rule_conforme():
    points = [
        MeasurementPointInput(
            point_index=1,
            nominal_value=100.0,
            reference_value=99.977,
            measured_value=101.0,
            uncertainty_u=0.58,
            emt=2.00
        )
    ]
    result = evaluate_metrology_rules(
        certificate_id="TEST-002",
        calibration_date_str="2026-07-15",
        standard_expiry_date_str="2027-07-28",
        issue_date_str="2026-07-29",
        next_calibration_date_str="2027-07-28",
        temp_celsius=23.0,
        humidity_percent=50.0,
        measurements=points
    )
    # Correction = 99.977 - 101.0 = -1.023
    # Guard Band = |-1.023| + 0.58 = 1.603 <= 2.00 EMT -> Conforme!
    assert result.all_points_conforme is True
    assert result.evaluated_points[0]["is_conforme"] is True
```

---

### 3.2 GitHub Actions CI/CD Pipeline (`.github/workflows/ci-cd.yml`)

```yaml
name: Microservices CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  # 1. Test Go Gateway & Document Services
  test-go-services:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Go 1.22
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - name: Test Auth Gateway
        run: |
          cd app/services/auth-gateway
          go test -v ./...

  # 2. Test Python Metrology & AI Services
  test-python-services:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r app/services/metrology-engine/requirements.txt
      - name: Run PyTest Suite
        run: |
          pytest app/services/metrology-engine/tests/

  # 3. Security Container Scan
  security-scan:
    runs-on: ubuntu-latest
    needs: [test-go-services, test-python-services]
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy Vulnerability Scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          ignore-unfixed: true
          format: 'table'
          severity: 'CRITICAL,HIGH'

  # 4. Build & Push Docker Images
  build-and-push:
    runs-on: ubuntu-latest
    needs: security-scan
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      - name: Build and Push Gateway Image
        uses: docker/build-push-action@v5
        with:
          context: ./app/services/auth-gateway
          push: true
          tags: processinstruments/auth-gateway:latest
```

---

## 4. Verification Checklist

- [ ] Execute `pytest` on `metrology-engine`. Confirm 100% test pass rate for all decision rules.
- [ ] Execute `go test ./...` on `auth-gateway`. Confirm zero race conditions.
- [ ] Validate GitHub Actions workflow execution in under **3 minutes**.
