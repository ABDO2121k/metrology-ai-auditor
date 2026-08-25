# Deployment Guide — Hybrid OCR Pipeline & Single-Role Platform

**Version**: 3.0 · **Date**: 2026-08-24

For *what* changed and why, see [UPDATE_SUMMARY.md](./UPDATE_SUMMARY.md). This
document covers running it.

---

## 1. How extraction works

Every certificate goes through the same pipeline. Steps 1–3 and 5 always run;
step 4 runs only when an API key is configured.

```
  1. RENDER      Each page is rasterised to a bounded longest side (2000 px)
                 and encoded JPEG. Any existing PDF text layer is kept.

  2. READ        Pages with a text layer use it directly. Scanned pages go
                 through RapidOCR, several pages at a time. Every line keeps
                 its bounding box, so the parser can tell a table row from a
                 heading and pair a label with the cell beside or beneath it.

  3. PARSE       Deterministic extraction of French metrology fields, dates,
                 numbers, domain and measurement-table geometry. No network.

  4. REFINE      (optional) A vision model receives the page images *and* the
                 local OCR transcript, and returns structured JSON. Anything
                 it reports that the transcript cannot corroborate is recorded
                 as a disagreement rather than trusted silently.

  5. AUDIT       Error, correction and guard band are recomputed from the
                 extracted values — never copied from the certificate. That is
                 what makes the math-discrepancy check meaningful.
```

### Running without an API key

The service is fully functional with no key. RapidOCR reads every certificate,
and header fields come back reliably. **Measurement tables are the limitation**:
a locally-reconstructed table has no column headers, so whether the fourth
number on a row is the EMT or the uncertainty depends on the form template.

Rather than guess, the service marks such extractions
`conformity_status: "INDETERMINE"` and recommends human review. The points are
still shown; the verdict is withheld. On the five sample certificates, four
yield no measurement points at all in this mode, and this is reported
explicitly.

Set `OPENAI_API_KEY` to have the vision layer read those tables with their
column semantics intact.

---

## 2. Configuration

### Required

Nothing. The defaults in `app/.env` boot a working stack.

### OCR

| Variable | Default | Meaning |
|---|---|---|
| `MOCK_OCR` | `false` | `true` serves fixture data for UI work. **Never enable in production** — it returns the same fake certificate for every upload. |
| `OCR_RENDER_MAX_SIDE` | `2000` | Rasterisation ceiling in px. Raising it improves OCR on dense tables at roughly quadratic cost. |
| `OCR_RENDER_RETRY_MAX_SIDE` | `3000` | Used for an automatic second pass when the first yields almost no text. |
| `OCR_PAGE_WORKERS` | `4` | Pages OCR'd in parallel. ONNX releases the GIL, so this scales close to linearly. |
| `OCR_MIN_LINE_SCORE` | `0.45` | Below this, a line is treated as scanner noise. |

### Vision layer (optional)

| Variable | Default | Meaning |
|---|---|---|
| `OPENAI_API_KEY` | *(empty)* | Empty disables the layer; the service stays fully functional. |
| `OCR_VISION_MODEL` | `gpt-4o` | |
| `OCR_VISION_TIMEOUT` | `90` | Seconds. |
| `OCR_VISION_MAX_RETRIES` | `2` | |
| `OCR_VISION_MAX_TOKENS` | `16000` | Headroom for long measurement tables. A truncated response is rejected, not parsed. |
| `OCR_MAX_VISION_PAGES` | `8` | Ceiling on pages sent in one request. |

### Audit thresholds (ISO 17025 / PR.ECE V9)

| Variable | Default |
|---|---|
| `AUDIT_TEMP_NOMINAL` | `23.0` °C |
| `AUDIT_TEMP_TOLERANCE` | `2.0` °C |
| `AUDIT_HUMIDITY_MAX` | `80.0` %HR |
| `AUDIT_MATH_TOLERANCE` | `0.0001` |
| `AUDIT_HYSTERESIS_EMT_FRACTION` | `0.5` |

### Frontend

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | **Inlined by Next.js at build time**, so it is passed as a Docker build arg, not only a runtime variable. Changing it requires a rebuild. |

---

## 3. Deploy

The `user_role` enum changed from four values to one, so a fresh volume is
required.

```bash
cd app/

docker compose down -v          # drops the old enum and data
docker compose up -d --build
```

Ten containers start: `postgres`, `redis`, `minio`, `createbuckets`,
`auth-gateway`, `document-ingestion`, `ocr-parsing`, `metrology-engine`,
`ai-anomaly`, `reporting-notification`, `web-frontend`.

`document-ingestion` waits for `ocr-parsing` to report healthy, so the first
upload is not lost to a cold service. The OCR container has a 90 s
`start_period` to cover model warm-up.

### With the vision layer

```bash
export OPENAI_API_KEY="sk-..."
docker compose up -d --build
```

Or set it in `app/.env`.

### Serving on a host other than localhost

```bash
export NEXT_PUBLIC_API_BASE_URL="http://your-host:8000"
docker compose up -d --build web-frontend   # rebuild required
```

---

## 4. Verify

```bash
# OCR service — reports which engines are actually available
curl http://localhost:8002/health
```

```json
{
  "status": "healthy",
  "service": "ocr-parsing",
  "mock_mode": false,
  "local_ocr_ready": true,
  "local_ocr_error": null,
  "vision_enabled": false,
  "vision_model": null,
  "warmup_complete": true
}
```

Check `mock_mode` is `false` and `local_ocr_ready` is `true`. If
`vision_enabled` is `false` and you expected otherwise, the key did not reach
the container.

```bash
curl http://localhost:8001/health        # document-ingestion
curl http://localhost:8000/health        # gateway
docker compose ps                        # all healthy
```

### Exercise the pipeline directly

Fastest way to see extraction quality without the UI:

```bash
cd app/
python scripts/test_all_pdfs.py
```

It prints, per certificate: the extracted fields, measurement points, which
engines ran, mean OCR confidence, render size, duration, and every blocking
anomaly, warning and hint.

### End-to-end through the UI

1. Sign in at `http://localhost:3000/login` — `fati_sadiki` / `fati2004@`.
2. **Upload** a certificate PDF. The response returns immediately (202) with
   status `OCR_PROCESSING`.
3. **Certificates** — the registry polls while any extraction is running and
   stops once everything settles. Expect 30–90 s for a scanned multi-page
   certificate.
4. Open a certificate. The detail view shows the audit verdict, blocking
   anomalies, conditions and traceability, the measurement table, and a
   *Diagnostic d'extraction* panel with per-field provenance.

---

## 5. Status lifecycle

```
  upload
    │
    ▼
  OCR_PROCESSING ──► OCR_COMPLETED       extraction stored, no blocking anomalies
    │                     │
    │                     └──► FLAGGED_ANOMALY   blocking anomalies found
    │
    └──► OCR_FAILED       extraction errored; retry with POST /:id/reprocess
```

`VALIDATED_CONFORME` and `REJECTED_NON_CONFORME` are set by the validation
workflow, not by extraction.

---

## 6. API

All routes require `Authorization: Bearer <token>`.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Public. |
| `GET` | `/api/v1/auth/profile` | |
| `PUT` | `/api/v1/auth/change-password` | |
| `POST` | `/api/v1/certificates/upload` | multipart `file`. Returns **202**; OCR runs in the background. |
| `GET` | `/api/v1/certificates/` | Supports `?status=` and `?search=`. Omits the OCR payload. |
| `GET` | `/api/v1/certificates/stats` | Dashboard KPIs. |
| `GET` | `/api/v1/certificates/:id` | |
| `GET` | `/api/v1/certificates/:id/ocr` | Stored extraction + measurements + anomalies. **Never triggers OCR.** |
| `POST` | `/api/v1/certificates/:id/reprocess` | Re-run extraction. |
| `DELETE` | `/api/v1/certificates/:id` | Removes the row and the MinIO object. |
| `GET` | `/api/v1/admin/users` | |
| `POST` | `/api/v1/admin/users/register` | Role is assigned server-side. |
| `PUT` | `/api/v1/admin/users/:id/reset-password` | |
| `GET` | `/api/v1/admin/system/health` | Real per-service probe results. |
| `POST` | `/api/v1/ocr/parse` | Direct extraction. Used by ingestion; also available for testing. |

Because there is a single role, every authenticated user may call every route.

---

## 7. Troubleshooting

**Every certificate comes back as `TTEC LAB` / `TACHYMETRE`**
`MOCK_OCR` is enabled. Check `curl http://localhost:8002/health` → `mock_mode`.
Set `MOCK_OCR=false` and restart `ocr-parsing`.

**`vision_enabled: false` when a key is set**
The variable did not reach the container. `docker compose config | grep -A2
OPENAI` to confirm it is being substituted, then recreate the service.

**Extraction finds fields but no measurement points**
Expected in local-only mode for most templates — see §1. The certificate's
warnings will say so explicitly. Set `OPENAI_API_KEY` for table extraction.

**`local_ocr_ready: false`**
RapidOCR failed to load; `local_ocr_error` carries the reason. Usually a missing
`libgl1`/`libglib2.0-0` (both installed by the Dockerfile) or an architecture
without an ONNX Runtime wheel.

**Extraction is slow**
~30–70 s per certificate on CPU is normal. Raise `OCR_PAGE_WORKERS` on a host
with more cores. Lowering `OCR_RENDER_MAX_SIDE` is faster but costs accuracy.

**Certificates stuck in `OCR_PROCESSING`**
Extraction runs in-process, so a container restart mid-run leaves the row
behind. `POST /api/v1/certificates/:id/reprocess`, or use the retry button in
the registry.

**Login fails**
The gateway re-seeds `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` on
every start, so `fati_sadiki` / `fati2004@` should always work. Check
`docker compose logs auth-gateway` for the seeding line. The bcrypt hashes in
`init-db.sql` are placeholders and are overwritten at startup by design.

**Frontend calls the wrong host**
`NEXT_PUBLIC_API_BASE_URL` is baked in at build time. Rebuild `web-frontend`
after changing it.

**Old role values in the database**
The gateway migrates them on start. If a query still fails on the enum, the
volume predates the schema change — `docker compose down -v` and rebuild.

---

## 8. Performance reference

Measured on the sample certificates, CPU only, `OCR_PAGE_WORKERS=6`:

| Certificate | Pages | Render size | Duration |
|---|---|---|---|
| Certif 1 | 2 | 551 KB | ~39 s |
| Certif 2 | 4 | 1,078 KB | ~50 s |
| Certif 3 | 3 | 731 KB | ~37 s |
| Certif 4 | 2 | 545 KB | ~31 s |
| Certif 5 | 6 | 1,473 KB | ~68 s |

Render sizes are the JPEG bytes actually produced. The previous PNG-at-150-dpi
approach produced 13.2 MB *per page* on these documents.

The vision layer adds roughly 5–15 s and $0.01–0.03 per certificate when
enabled. Extraction runs once and is stored, so viewing a certificate afterwards
costs nothing.
