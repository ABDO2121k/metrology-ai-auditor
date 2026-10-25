# Metrology AI Auditor

Microservice platform that reads calibration certificates (scanned PDFs), extracts their measurements, checks them against **ISO/IEC 17025** metrological rules and flags suspicious certificates with an anomaly-detection model.

## Architecture

```
            Next.js 14 web app (:3000)
                     │ HTTPS
                     ▼
     Auth gateway — Go / Fiber (:8000)
     JWT, RBAC, rate limiting, reverse proxy
        │            │             │             │             │
        ▼            ▼             ▼             ▼             ▼
  Document       OCR parsing   Metrology     AI anomaly    Reporting &
  ingestion      Python        rule engine   Python        notification
  Go (:8001)     (:8002)       Python        (:8004)       Node.js/TS
                               (:8003)                     (:8005)
        │            │             │             │
        └──── PostgreSQL ── Redis ── MinIO (object storage) ────┘
```

| Service | Stack | Role |
|---|---|---|
| `auth-gateway` | Go, Fiber | JWT auth, role-based access, rate limiting, routing |
| `document-ingestion` | Go | Upload, storage in MinIO, background extraction jobs |
| `ocr-parsing` | Python, FastAPI, RapidOCR | Local OCR, optional vision-model refinement cross-checked against the local reading, field parsing |
| `metrology-engine` | Python, FastAPI | Rule evaluation (tolerances, units, traceability, dates) |
| `ai-anomaly` | Python, scikit-learn, ONNX Runtime | Isolation Forest trained offline, exported to ONNX, served from FastAPI |
| `reporting-notification` | Node.js, TypeScript | Reports and notifications |
| `frontend` | Next.js 14, Tailwind | Upload, field inspector, validation studio, dashboards |

## Results (measured on the sample certificates)

- Page rendering: bounded JPEG instead of 150-dpi PNG, **13.2 MB → 255 KB per page**
- Parallel page OCR: a 6-page certificate went from **194 s to 60 s**
- Extraction runs once at upload, in the background, and the full result is persisted

## Run locally

```bash
cp .env.example .env        # add OPENAI_API_KEY to enable the vision refinement (optional)
docker compose up --build
# web app: http://localhost:3000   gateway: http://localhost:8000
```

## Production

`docker-compose.prod.yml` runs the stack behind **Nginx** (`deploy/nginx.conf`) on an **Oracle Cloud** ARM instance, with PostgreSQL, Redis and MinIO kept off the public network. See [`deploy/ORACLE_CLOUD.md`](deploy/ORACLE_CLOUD.md).

## Docs

- [`plan/`](plan/): step-by-step design of every microservice and the epics
- [`UPDATE_SUMMARY.md`](UPDATE_SUMMARY.md): OCR rebuild and measured results
- [`DEPLOYMENT_GUIDE_AI_OCR.md`](DEPLOYMENT_GUIDE_AI_OCR.md): deployment of the AI OCR path
