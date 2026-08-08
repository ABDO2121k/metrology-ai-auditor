# System Overview: Intelligent Metrological Validation & Anomaly Detection Platform

## 1. Executive Summary & Vision

The **Process Instruments Intelligent Validation Platform** is an enterprise-grade, microservice-based AI application engineered for the automated verification, metrological audit, and anomaly detection of calibration certificates and verification reports.

Operating within ISO/IEC 17025:2017 (NM 2018) compliance standards and internal Process Instruments procedures (**PR.ECE V9** and **PRO.MDD V23**), the platform eliminates manual verification bottlenecks, reduces human error, guarantees metrological traceability, and prevents non-conforming or fraudulent certificates from reaching clients.

---

## 2. Microservice Architecture Diagram

```
                               ┌──────────────────────────────────────────────┐
                               │           Next.js 14 Web Frontend            │
                               │      (Modern Glassmorphism UI / Vite)        │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTPS / WSS
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │      API Gateway & Auth Service (Go/Fiber)   │
                               │    (JWT Auth, RBAC, Rate Limiter, Reverse Proxy)│
                               └──────┬───────────────────────┬───────────────┘
                                      │                       │
           ┌──────────────────────────┴───────────────┐       │
           │ HTTP / gRPC                              │ gRPC  │ HTTP / gRPC
           ▼                                          ▼       ▼
┌───────────────────────┐             ┌────────────────────────────────────────┐
│ Document Ingestion &  │             │   Ultra-Fast OCR & Parsing Service     │
│ Storage Service (Go)  ├────────────►│       (Python FastAPI + PaddleOCR)     │
└──────────┬────────────┘  Event Queue└───────────────────┬────────────────────┘
           │               (Redis/RabbitMQ)               │ Extracted JSON
           │ Stream Upload                                ▼
           ▼                          ┌────────────────────────────────────────┐
┌───────────────────────┐             │  Metrological Rule Engine Service      │
│ MinIO Object Storage  │             │     (Python/Go ISO 17025 Validator)    │
│ (PDF & JSON Storage)  │             └───────────────────┬────────────────────┘
└───────────────────────┘                                 │ Validated Data
                                                          ▼
                                      ┌────────────────────────────────────────┐
                                      │  AI Anomaly Detection Service          │
                                      │     (Python FastAPI + PyTorch/LightGBM)│
                                      └───────────────────┬────────────────────┘
                                                          │ Anomaly Score & Logs
                                                          ▼
┌───────────────────────┐             ┌────────────────────────────────────────┐
│ PostgreSQL 16 DB      │             │  Report & Notification Service (Node/Go│
│ (Relational Data)     │◄────────────┤   (Audit Log, PDF Reports, Email/WS)   │
└───────────────────────┘             └────────────────────────────────────────┘
```

---

## 3. Technology Stack Selection & High-Speed Performance Rationale

To achieve maximum throughput, sub-second certificate verification, ultra-low memory overhead, and zero single-point-of-failure risks, the traditional heavy stack (Django / Monolithic React / Tesseract OCR) has been replaced with the following optimal technology stack:

| Domain | Legacy / Traditional Tech | Selected Ultra-Fast Stack | Rationale & Performance Gain |
| :--- | :--- | :--- | :--- |
| **API Gateway & Auth** | Django Monolith | **Go (Fiber v2 / Gin)** | **10x-50x faster** than Django/Flask. Sub-millisecond routing, zero-allocation memory pool, native concurrency. |
| **Primary Storage** | Local Disk / Django Media | **MinIO S3-Compatible Object Store** | Distributed, high concurrency stream uploads with automatic SHA-256 deduplication and bucket lifecycle rules. |
| **OCR & Table Extraction**| Tesseract OCR / pdfplumber | **PaddleOCR + RapidOCR + PyMuPDF (FitZ)** | **5x-10x faster execution**, GPU/CPU SIMD optimized, superior table grid detection & multilingual support over Tesseract. |
| **Metrological Rule Engine**| Python sequential loops | **Go / Python Numba Vectorized Engine** | Microsecond execution of math formulas ($Erreur$, $Correction$, $EMT$, $Hysteresis$). |
| **AI Anomaly Detection** | Heavy TensorFlow Monolith | **LightGBM + PyTorch ONNX Runtime + IsolationForest** | Low memory footprint (<200MB), ONNX C++ execution backend for **<15ms inference latency**. |
| **Reporting & Webhooks** | Synchronous Python script | **Go / Node.js (Fastify) + BullMQ / Redis Queue** | Asynchronous background processing, PDF generation via Chromium headless stream, instant WebSockets. |
| **Database & Cache** | Basic MySQL / SQLite | **PostgreSQL 16 (Partitioned) + Redis 7 Cache** | JSONB binary metadata storage, full-text search indexing, Redis pub-sub for real-time dashboard alerts. |
| **Frontend UI** | React + Bootstrap | **Next.js 14 (App Router) + Tailwind CSS + TanStack Query** | Server-side rendering, instant page transitions, glassmorphism design system, optimized bundle size. |

---

## 4. Key Metrological Rules & AI Validation Logic (ISO 17025 / PR.ECE V9)

The platform evaluates every certificate against strict mathematical and normative checks:

1. **Administrative & Traceability Validation**:
   - **Standard Expiry Check**: $\text{Date\_Étalonnage} \le \text{Date\_Validité\_Étalon}$. Validation is **BLOCKED** if standard was expired at calibration time.
   - **Document Integrity**: Page count extracted via OCR must match announced count in title block.
   - **Chronology Check**: $\text{Date\_Étalonnage} \le \text{Date\_Émission} \le \text{Date\_Validation} < \text{Date\_Prochain\_Étalonnage}$.
   - **Signature & Stamp Check**: OpenCV/ResNet classification for validator signature and official laboratory seal.

2. **Metrological Calculations & Tolerance Engine**:
   - **Error Recalculation**: 
     $$\text{Erreur\_Calculée} = |\text{Valeur\_Lue} - \text{Valeur\_Référence}|$$
   - **Correction Calculation**:
     $$\text{Correction} = \text{Valeur\_Référence} - \text{Valeur\_Mesurée}$$
   - **Hysteresis & Repeatability**:
     $$\Delta_{\text{Hystérèse}} = |\text{Correction}_{\text{Retour}} - \text{Correction}_{\text{Aller}}| \le \text{Seuil}_{\text{Toléré}}$$
   - **Environmental Compliance**: Temperature ($23^\circ\text{C} \pm 2^\circ\text{C}$) & Relative Humidity ($\le 80\%\text{HR}$).

3. **Conformity & Guard Band Decision Rule**:
   - **Strict Decision Rule**:
     $$\text{Conforme} \iff |\text{Correction}| + U \le \text{EMT}$$
     Where $U$ is expanded uncertainty ($k=2$, 95% confidence interval) and $\text{EMT}$ is Maximum Permissible Error.
   - **Probability of False Acceptance (PFA)**: Must enforce $\text{PFA} \le 2.5\%$.

---

## 5. Microservices Breakdown

1. **`auth-gateway-service` (Port 8000)**: Authentication, RBAC (Admin, Technician, Validator), JWT token verification, dynamic route proxying.
2. **`document-ingestion-service` (Port 8001)**: PDF upload, file hashing (SHA-256), MinIO object storage (`metrology-certificates` bucket), raw document metadata management.
3. **`ocr-parsing-service` (Port 8002)**: PDF page rasterization, PaddleOCR text extraction, table layout recognition, key-value pair parsing.
4. **`metrology-engine-service` (Port 8003)**: ISO 17025 rules, error recalculation, tolerance verification, environmental range verification.
5. **`ai-anomaly-service` (Port 8004)**: Isolation Forest & LightGBM inference, anomaly scoring, fraud detection, statistical drift check.
6. **`reporting-service` (Port 8005)**: PDF audit report generation (saved to MinIO `audit-reports` bucket), email notifications, WebSocket event distribution.
7. **`web-frontend` (Port 3000)**: Next.js 14 glassmorphism user interface with dashboard, real-time alerts, and certificate viewer.

---

## 6. Single-Command Deployment via Docker Compose

Deployment is executed using a single Docker Compose command:

```bash
cd app/
docker compose up -d --build
```

This starts all 10 containers (`auth-gateway`, `document-ingestion`, `ocr-parsing`, `metrology-engine`, `ai-anomaly`, `reporting-notification`, `web-frontend`, `postgres`, `redis`, and `minio` with auto-bucket initialization).

---

## 7. Plan Directory Structure

The `app/plan/` directory contains step-by-step actionable guides designed for rapid, error-free implementation:

- [overview.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/overview.md) - High-level system architecture, technology rationale, and ISO 17025 rules.
- [step1_architecture_and_infrastructure_setup.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step1_architecture_and_infrastructure_setup.md) - Step 1: Microservices Infrastructure, Docker Compose, Redis, Postgres, MinIO setup.
- [step2_gateway_auth_microservice.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step2_gateway_auth_microservice.md) - Step 2: High-Performance Go API Gateway & Authentication Service.
- [step3_document_storage_ingestion_microservice.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step3_document_storage_ingestion_microservice.md) - Step 3: Document Ingestion, SHA-256 Deduplication & MinIO S3 Storage.
- [step4_ocr_parsing_microservice.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step4_ocr_parsing_microservice.md) - Step 4: Ultra-Fast AI OCR & Table Parsing Service (PaddleOCR + PyMuPDF).
- [step5_metrological_rule_engine_microservice.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step5_metrological_rule_engine_microservice.md) - Step 5: ISO 17025 Metrological Rule Engine & Decision Service.
- [step6_ai_anomaly_detection_microservice.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step6_ai_anomaly_detection_microservice.md) - Step 6: AI Anomaly & Fraud Detection Microservice (LightGBM/IsolationForest).
- [step7_reporting_notification_microservice.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step7_reporting_notification_microservice.md) - Step 7: Audit Report Generation, WebSockets & Notification Service (MinIO PDF reports).
- [step8_frontend_microservices_dashboard.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step8_frontend_microservices_dashboard.md) - Step 8: Next.js 14 Glassmorphism Web Interface & Validator Workflows.
- [step9_microservices_integration_testing_cicd.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step9_microservices_integration_testing_cicd.md) - Step 9: Integration Testing, Automated QA, and GitHub Actions CI/CD.
- [step10_deployment_monitoring_production_readiness.md](file:///c:/Users/abdok/OneDrive/Desktop/fati_project/app/plan/step10_deployment_monitoring_production_readiness.md) - Step 10: Production Deployment via Single-Command Docker Compose & MinIO.
