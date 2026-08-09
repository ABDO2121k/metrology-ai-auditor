# Step 8.3: OCR Extraction & Field Inspection Studio

## 1. Overview & Objectives

This sub-step specifies the **OCR Extraction & Inspection Studio** (`/ocr-inspector/[id]`), connected directly to the **`ocr-parsing`** microservice (Port 8002).

Per Section 3 of the project report and **PR.ECE V9**, the system must automatically detect and extract administrative header fields, laboratory logos, accreditation seals, and measurement data grids.

---

## 2. Key Elements Verified by OCR Engine & Rendered in UI

Per Section 3 of the project specifications, the UI highlights:
- [x] **Présence du logo du laboratoire** (Process Instruments Seal)
- [x] **Présence du logo d'accréditation** (Cofrac / NM / ISO 17025 Seal)
- [x] **Numéro du certificat** (e.g. `ARRM13388-26`)
- [x] **Date d'émission** (e.g. `2026-07-29`)
- [x] **Date d'étalonnage** (e.g. `2026-07-29`)
- [x] **Date de validation** (e.g. `2026-07-30`)
- [x] **Date du prochain étalonnage** (e.g. `2027-07-29`)
- [x] **Conditions ambiantes** (Température: $23.0^\circ\text{C}$, Humidité: $50.0\%$)
- [x] **Responsable d'étalonnage** (Technicien Étalonneur)
- [x] **Responsable de validation** (Qualité / Métrologiste Habilité)
- [x] **Nombre de pages** (e.g. 2 pages, 4 pages, 6 pages)

---

## 3. UI Features (`src/app/ocr-inspector/[id]/page.tsx`)

1. **Interactive Bounding Box Overlay**:
   - Displays rasterized PDF page canvas with color-coded bounding boxes around detected key-value pairs (Header: Blue, Tables: Green, Seals: Purple).
2. **Side-by-Side Field Editing Table**:
   - Allows technicians to inspect extracted text confidence scores (%) and make manual corrections if OCR confidence is $< 90\%$.
3. **Table Grid Extraction Preview**:
   - Formats extracted measurement rows into structured JSON/HTML data preview before sending to the metrology rule engine.
