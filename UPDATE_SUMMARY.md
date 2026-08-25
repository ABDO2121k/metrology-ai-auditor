# Update Summary — OCR Rebuild & Single-Role Consolidation

**Version**: 3.0
**Date**: 2026-08-24
**Supersedes**: v2.0 (AI-Enhanced OCR)

---

## 1. What changed, in one paragraph

The OCR service was rebuilt around a hybrid pipeline: every certificate is read
locally with RapidOCR, and — when an API key is configured — refined by a vision
model whose output is cross-checked against that local reading. Extraction now
happens once, at upload, in the background, and the full result is persisted.
Separately, the four roles (ADMINISTRATOR / TECHNICIAN / VALIDATOR / DIRECTOR)
were collapsed into a single **TECHNICIAN** role that can do everything.

---

## 2. The OCR rebuild

### 2.1 The bug that broke everything

`docker-compose.yml` set `MOCK_OCR: "true"`, so the service returned the same
hardcoded fixture (`TTEC LAB` / `TACHYMETRE` / `C172450726`) for every PDF
uploaded. No real extraction ran at all. It is now `"false"`.

`OPENAI_API_KEY` was never passed to the container either, so even with mock
mode off, the vision path returned `None` on every call.

### 2.2 Rasterisation: ~50x smaller

The sample certificates are scans with no text layer, on very large pages
(1768 x 2500 pt). The old code called `page.get_pixmap(dpi=150)`, producing a
**13.2 MB PNG per page** — measured, not estimated. Six pages base64-encoded
into one vision request came to roughly 100 MB, far past any model's request
ceiling, and slow enough to blow the caller's timeout on its own.

Pages are now scaled to a bounded longest side (2000 px default) and encoded as
JPEG:

| | Old (PNG @ 150 dpi) | New (JPEG @ 2000 px) |
|---|---|---|
| Per page | 13,222 KB | 255 KB |
| Certif 1 (2 pages) | ~26 MB | 552 KB |
| Certif 5 (6 pages) | ~79 MB | 1,473 KB |

No measurable loss of OCR accuracy: 2000 px keeps 8–9 px glyph height on a
scanned A4, comfortably above what both RapidOCR and vision models need.

### 2.3 Parallel page OCR

ONNX Runtime releases the GIL during native inference, so pages are OCR'd
concurrently (`OCR_PAGE_WORKERS`, default 4). Certif 5 went from **194 s to
60 s** end to end.

### 2.4 Module layout

The 691-line `ocr_engine.py` was split into focused modules:

| Module | Responsibility |
|---|---|
| `render.py` | Bounded rasterisation, text-layer detection |
| `local_ocr.py` | RapidOCR wrapper, line geometry, engine warm-up |
| `parsing.py` | French field labels, dates, numbers, domain, table geometry |
| `vision.py` | Optional vision refinement, cross-checked |
| `audit.py` | ISO 17025 checks — guard band, chronology, hysteresis, environment |
| `ocr_engine.py` | Orchestration and merge |

### 2.5 Correctness fixes in parsing

| Problem | Old behaviour | Now |
|---|---|---|
| Tolerance strings | `20±10℃` parsed as **2010.0** (± stripped, digits spliced) | `20.0` |
| Impossible dates | `13/13/2026` silently swapped fields into a wrong date | `None` |
| French dates | `04/05/2026` ambiguous | `2026-05-04` (day-first) |
| Certificate number | `N°ARRM13388-26` not matched; footer tax IDs matched instead | `ARRM13388-26`; `IF 3120549` / `ICE …` rejected |
| Glued number marker | `N'ARTL05391-26/A` → `NARTL05391-26/A` | `ARTL05391-26/A` |
| Label bleed | `humidité relative:` → value `"relative"`; `Serial number` → `"number"` | rejected via stopword list + per-field validators |
| Fullwidth punctuation | serial `：113557SBH` | `113557SBH` |
| Stacked labels | only looked right of a label | looks right **and** below |
| Domain | second `detect_domain` call overwrote the vision answer; stray `min`/`s` tokens outvoted the instrument name | units vote only from accepted measurement rows; otherwise instrument wording wins |
| Unit default | defaulted to `"V"` for unknown domains | domain-appropriate, or empty |
| Attached units | `100.0mV` matched no unit (`\b` fails digit→letter) | `mV` |
| Uncertainty hack | `if unc > 1000 and domain == ROTATION-SPEED: unc = 0.4` | removed; replaced by physical invariants |
| Dropped spaces | `DELIVREA` / `Nodeserie` matched no label at all | labels matched against a space-stripped copy, with an offset map back to the original |
| Reference standard | letters-only regex matched `NAGE` — the tail of *ÉTALON**NAGE*** — and the certificate's own number | code must contain a digit; the document's own number is rejected even when OCR-mangled |
| Domain (thermal) | every certificate says "température ambiante" in its conditions block, forcing THERMAL | thermal needs a specific term (PT100, étuve, thermocouple…) |

### 2.6 Refusing to invent measurements

The old local fallback accepted any line with ≥3 numbers as a measurement row.
On Certif 1 that produced points like *"6.0 min, EMT 2027.0"* — the `2027` being
a year — which the audit then dutifully failed, reporting a confident
**NON_CONFORME** built entirely on noise.

Rows must now clear several independent checks:

- carry an explicit unit token;
- repeat the same `(unit, column-count)` shape at least twice (one isolated row
  is indistinguishable from noise);
- contain no year-like or date-like values;
- satisfy `|measured − reference| ≤ 10%` — the defining invariant of a
  calibration point, which is what caught Certif 5's OCR-mangled `499995V` row;
- have uncertainty and EMT small relative to the measured value.

When they do not, the service returns **no measurements and says why**, rather
than fabricating them.

### 2.7 Honest verdicts when columns are inferred

A locally-reconstructed table has no column headers, so whether the fourth
number is the EMT or the uncertainty depends on the form template. Rather than
guess and issue a verdict, extractions from the local table path are marked
`conformity_status: "INDETERMINE"` with
`validation_recommendation: "NEEDS_HUMAN_REVIEW"` and an explicit warning. The
points are still surfaced for the technician to read. Vision-extracted tables,
which do carry column semantics, get a real verdict.

Similarly, a page-count mismatch derived from an OCR-read `page 2/3` marker is a
**warning**; only a count read confidently by the vision layer **blocks**.

### 2.8 Vision layer hardening

- `max_tokens` 3,000 → 16,000. The old ceiling truncated the JSON mid-table on
  any certificate with more than a handful of points, surfacing as a parse
  failure and an empty result.
- A `finish_reason == "length"` response is now rejected outright rather than
  parsed as if complete.
- Retries with backoff; explicit timeout.
- The model receives the local OCR transcript alongside the images, so a value
  it reports that the transcript cannot corroborate is flagged as a
  disagreement rather than trusted silently.
- `openai` 1.3.0 → 1.30.5.

### 2.9 Provenance

Every extracted field records where it came from (`VISION`, `LOCAL_OCR`,
`TEXT_LAYER`, `REGEX`, `LAYOUT`, `PATTERN`, `NONE`), its confidence, and whether
the two readings agreed. Surfaced in the certificate detail view under
*Diagnostic d'extraction*.

---

## 3. Measured results (local-only, no API key)

Run over the five sample certificates with no `OPENAI_API_KEY` set — i.e. the
weakest configuration the service supports:

| | Certif 1 | Certif 2 | Certif 3 | Certif 4 | Certif 5 |
|---|---|---|---|---|---|
| Pages | 2 | 4 | 3 | 2 | 6 |
| Certificate № | `ARRM13388-26` | `AETE04897-26` | `ARTL05391-26/A` | `ARBI13361-26` | `AENS12791-26` |
| Client | ROCAMAROC | TARFAYA ENERGY COMPANY (TAREC) | TTECLAB | BIOPHARMA | NSK STEERING SYSTEMS MOROCCO |
| Instrument | AGITATEUR | CONTROLEUR DE TERRE ET DE RESISTIVITE | TACHYMETRE | centrifugeuse | MULTIMETRE |
| Serial | 20-AG000-01 | 113557SBH | TAC01 | — | 71370257 |
| Domain | ROTATION-SPEED | ELECTRICITY-MAGNETISM | ROTATION-SPEED | ROTATION-SPEED | ELECTRICITY-MAGNETISM |
| Calibration date | 2026-07-15 | 2026-04-08 | — | — | 2026-07-17 |
| Measurement points | 0 | 5 | 2 | 0 | 47 |
| Confidence | 0.81 | 0.80 | 0.81 | 0.35 | 0.79 |
| Render size | 551 KB | 1,078 KB | 731 KB | 545 KB | 1,473 KB |
| Mean OCR confidence | 0.87 | 0.85 | 0.87 | 0.87 | 0.83 |

Certificate numbers **5/5** · clients **5/5** · instruments **5/5** ·
domains **5/5** · serials **4/5** · calibration dates **3/5**.

### Two fixes that moved the needle

**1. OCR drops inter-word spaces.** The header reads `DELIVREA`, `Nodeserie`,
`Dated'emission`, so no label in the table ever matched and the parser never
reached its adjacent-cell lookup. Matching against a space-stripped copy —
keeping an offset map back into the original so the value can still be sliced
out — took clients to 5/5, serials to 4/5 and calibration dates from 1/5 to
3/5, lifting confidence from 0.35 to ~0.80.

**2. RapidOCR does not render the unit symbols the certificates print.** The
ohm sign comes back as `Q`, `kQ` or `k²`; micro arrives as Greek mu (U+03BC)
rather than the micro sign (U+00B5). Because a band needs a recognised unit to
count as a measurement row, an entire resistance certificate's table was being
discarded. The unit table now lists the spellings OCR actually produces and
folds them onto the real symbol.

Alongside that, two structural limits were lifted: sections were grouped by
`(unit, exact column count)`, which split one table in two when OCR merged a
cell, and only the **largest** group was kept — so a multimeter certificate
calibrated across V, mV, A, mA and µA silently lost every range but voltage.
Every unit section that holds up on its own is now accepted.

| Certificate | Quantities measured | Points before | Points after |
|---|---|---|---|
| Certif 1 — agitator | rotation speed | 0 | 0 |
| Certif 2 — earth/resistivity tester | Ω, kΩ | 0 | **5** |
| Certif 3 — tachometer | tr/min | 0 | **2** |
| Certif 4 — centrifuge | rotation speed | 0 | 0 |
| Certif 5 — multimeter | V, mV, A, mA, µA, Ω, kΩ | 25 | **47** |
| **Total** | | **25** | **54** |

### The honest weak spot

**Certif 1 and Certif 4 still yield no measurement points.** Their tables are
not recovered as coherent bands by the local pass at all — the only unit-bearing
line OCR produces on Certif 1 is the reference-standard row
(`Tachymetre optique 6a99900tr/min`), not a measurement. Both certificates
report this explicitly rather than inventing rows.

**Column semantics remain inferred.** On Certif 2 the row
`1,0134Ω  1,00Ω  -0,0134Ω  0.0082Ω` is read correctly, but nothing in the OCR
says whether the third column is the correction and the fourth the uncertainty,
or the other way round. The values are surfaced for the technician; the
conformity verdict is withheld as `INDETERMINE`. Set `OPENAI_API_KEY` and the
vision layer supplies the column meaning along with the numbers.

## 4. Persistence — extraction now happens once

Previously `measurement_points` was **never written to** by any code path, and
`ai_validation` was dropped on the floor. The certificate detail page
compensated by POSTing to `/ocr/parse` on **every page view**, re-running a full
extraction (and, with a key configured, re-billing it) just to look at a record.

Now:

- Upload returns **202 Accepted** immediately; OCR runs in the background.
- The complete extraction is stored in `certificates.ocr_payload` (JSONB),
  alongside `ocr_confidence`, `extraction_quality`, `conformity_status`,
  `ocr_error` and `ocr_completed_at`.
- Measurement points are written to `measurement_points` (now including `unit`
  and `parameter` columns — a measurement without its unit cannot be audited).
- Audit findings are written to `anomaly_audit_logs`, bucketed into the
  categories the dashboard charts.
- All of it in **one transaction**, so a partial failure cannot leave a
  certificate marked complete with no measurements behind it.
- Re-running replaces prior rows rather than appending.

New endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/certificates/:id/ocr` | Stored extraction. Never triggers OCR. |
| `POST /api/v1/certificates/:id/reprocess` | Re-run extraction on demand. |
| `GET /api/v1/certificates/stats` | Real KPI counts for the dashboard. |

New status `OCR_FAILED` makes a stuck document visible instead of silently
sitting in `OCR_PROCESSING` forever.

---

## 5. Single role

Four roles collapsed into **TECHNICIAN**, which carries every permission.

| Layer | Before | After |
|---|---|---|
| Postgres enum | 4 values | `CREATE TYPE user_role AS ENUM ('TECHNICIAN')` |
| Go model | 4 constants | `RoleTechnician` + `Normalize()` coercion |
| Gateway | `RequireRole(...)` per route | `RequireAuthenticated()` |
| Registration | client-supplied role | coerced server-side |
| Seeded accounts | 4 logins | 1 (`fati_sadiki` / `fati2004@`) |
| Frontend guard | per-route role table | authentication only |
| Sidebar | 4 role-filtered blocks | one nav list |
| Dashboard | 4 role branches | one dashboard |

Existing deployments are migrated on gateway start:
`UPDATE users SET role = 'TECHNICIAN' WHERE role::text <> 'TECHNICIAN'`.

---

## 6. Other correctness fixes

- **Dashboard link was in the wrong branch** of `layout.tsx` — it rendered only
  for signed-out visitors, who could not use it. Moved to the signed-in branch.
- **Dead navigation.** The sidebar linked to `/eval-5certs`, `/reports` and
  `/director-dashboard`. No such pages exist; every click was a 404. Removed.
- **`GetSystemHealth` always reported "healthy"** — it assigned `"healthy"` in
  *both* branches of its error check, so the operations page showed 9/9 green
  with services down. It now reports `healthy` / `degraded` / `unhealthy` /
  `unreachable` with the failure detail, and probes Postgres and Redis over
  their own protocols instead of pinging the gateway's own health URL.
- **Hardcoded `http://localhost:8000`** in eight places meant the app only
  worked from the developer's machine. Centralised in `src/lib/api.ts` behind
  `NEXT_PUBLIC_API_BASE_URL`.
- **Fabricated dashboard KPIs.** The technician view hardcoded `'5'`, `'2'`,
  `'4'`, `'1'`; validator and director hardcoded `'80%'`. All read from
  `/certificates/stats` now.
- **Tailwind classes built by interpolation** (`text-${color}-400`) were never
  generated, so KPI numbers rendered unstyled. Replaced with a static map.
- **Status list mismatched the database.** The registry listed `OCR_COMPLETE`,
  `PROCESSING` and `VALIDATED_NON_CONFORME` — none of which the enum can
  produce — while omitting the real ones, so most rows fell through to the
  "Pending OCR" default. Aligned exactly to the enum.
- **AuthGuard rendered children before checking**, briefly exposing protected
  pages and firing their requests without a token. It now holds them back.
- **401 handling**: a stale token left the app looking signed in while every
  request failed. `apiFetch` now clears the session and redirects.
- **Frontend Dockerfile** used `npm install || true`, turning dependency
  failures into confusing "module not found" errors later in the build.
- **Duplicate-check bug**: `.Count()` could not distinguish "no duplicate" from
  a query error. Now uses `First` + explicit `ErrRecordNotFound`.
- **Upload size** is checked client-side before a long upload is wasted.
- OCR models are baked into the image and warmed at startup, so the first
  request after a deploy does not pay model-load time inside the caller's
  timeout.

---

## 7. Configuration

```bash
# Real extraction (was "true", which disabled OCR entirely)
MOCK_OCR=false

# Optional vision refinement. Empty = local-only, still fully functional.
OPENAI_API_KEY=
OCR_VISION_MODEL=gpt-4o

OCR_RENDER_MAX_SIDE=2000    # rasterisation ceiling, px
OCR_PAGE_WORKERS=4          # pages OCR'd in parallel

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000   # inlined at build time
```

---

## 8. Deploy

```bash
cd app/

# A fresh database is required: the user_role enum changed.
docker compose down -v
docker compose up -d --build
```

Sign in with `fati_sadiki` / `fati2004@`.

Verify:

```bash
curl http://localhost:8002/health   # local_ocr_ready, vision_enabled
curl http://localhost:8001/health
docker compose logs -f ocr-parsing
```

Exercise the pipeline directly against the sample PDFs:

```bash
python scripts/test_all_pdfs.py
```

---

## 9. Known limitations

1. **Two certificates yield no measurement points** locally (Certif 1, Certif 4)
   — their tables are not recovered as coherent bands by the OCR pass. Reported
   explicitly, never invented.
2. **Column semantics are inferred** for locally-read tables, so those
   extractions are marked `INDETERMINE` and recommended for human review rather
   than given a conformity verdict. The vision layer resolves this.
3. **Serial number** is missed on Certif 4 and **calibration date** on Certif 3
   and 4. Both are reported missing rather than guessed.
4. **Word spacing.** Values arrive without inter-word spaces on the worst scans
   (`TTECLAB`, `CONTROLEURDETERREETDERESISTIVITE`). The text is correct and
   searchable; only its presentation suffers.
5. **Speed.** ~30–70 s per certificate on an unloaded CPU. Under memory
   pressure a page can fail with "ONNXRuntime inference failed"; the run
   continues, the page is skipped, and the reason is recorded in
   `diagnostics.local_ocr_error`. `OCR_PAGE_WORKERS=4` is the safe default.
6. **Vision cost**, when enabled, is roughly $0.01–0.03 per certificate.
   Extraction runs once and is stored, so viewing a certificate is free.

## 10. Verification performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | passes |
| `npx next build` | passes — 9 routes, no lint or type errors |
| All 8 OCR modules parse and import | passes |
| `docker compose config` | valid |
| `python scripts/test_all_pdfs.py` over all 5 real certificates | completes, results in §3 |

**Not verified:** the Go services were not compiled — no Go toolchain is
installed on this machine and the Docker daemon was not running. They were
reviewed by hand for import usage and structural balance, but `docker compose
up --build` is the first real compile of `auth-gateway` and
`document-ingestion`.
