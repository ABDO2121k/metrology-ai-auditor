# Step 8.7: Unified Validator Dashboard & End-to-End Workflows

## 1. Overview & Objectives

This sub-step combines all individual components into a **Unified Validator Dashboard & End-to-End Operational Workflow** in the **`web-frontend`** Next.js 14 web application.

It connects all 8 system microservices into a seamless 4-step pipeline:

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  1. UPLOAD & INGESTION │ ───► │  2. OCR & FIELD CHECK  │ ───► │  3. METROLOGY & AI     │ ───► │  4. VALIDATION & SIGN  │
│  (Port 8001 / MinIO)   │      │  (Port 8002 / FitZ)    │      │  (Ports 8003 & 8004)   │      │  (Port 8005 / Reports) │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

---

## 2. Complete Application Route Sitemap (`src/app/`)

| Route Path | Screen Name | Access Roles | Key Functionality |
| :--- | :--- | :--- | :--- |
| `/login` | Glassmorphism Login | All Roles | JWT Token Authentication connected to `auth-gateway` (Port 8000). |
| `/` | Dashboard Overview | All Roles | Real-time KPIs, 8 Microservices Health Matrix, 5 Certificate Models quick launcher. |
| `/upload` | PDF Upload Studio | Technician, Validator | Multi-file drag & drop PDF uploader connected to `document-ingestion` (Port 8001). |
| `/eval-5certs` | 5 Certificate Studio | Technician, Validator | 1-click execution for all 5 certificate models showing live OCR, Metrology, AI Anomaly, and PDF generation. |
| `/certificates` | Certificate Grid | All Roles | Filterable table of all uploaded certificates with status badges (`CONFORME`, `ANOMALIE`). |
| `/certificates/[id]` | Split-View Studio | Validator, Admin | Side-by-side original PDF vs ISO 17025 metrology table & 1-click Approve/Reject actions. |
| `/reports` | Audit Report Archive | Validator, Admin | List of generated PDF audit reports stored in MinIO bucket `audit-reports`. |

---

## 3. End-to-End Verification Plan (Docker Compose)

1. **Upload Certificate PDF**: Navigate to `/upload`, upload `ARRM13388-26.pdf`. Verify file reaches MinIO bucket `metrology-certificates`.
2. **Execute OCR & Metrology**: Observe automated extraction of header text, seals, and measurement tables ($|\text{Corr}| + U \le \text{EMT}$).
3. **Check AI Anomaly Score**: Inspect ONNX prediction score ($0.05$ for Certif 1-4, $0.90$ for Certif 5).
4. **Approve / Sign Certificate**: Open `/certificates/ARRM13388-26`, click **Valider & Signer**. Verify audit report PDF is generated and saved in MinIO bucket `audit-reports`.
