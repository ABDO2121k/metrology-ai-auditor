# EPIC 3: OCR Extraction & Field Inspector Studio

## 1. Executive Summary & Vision

This Epic specifies the **OCR Extraction & Inspection Studio** (`/ocr-inspector/[id]`), connected directly to **`ocr-parsing`** (Port 8002).

Per Section 3 of the project report and **PR.ECE V9**, the OCR engine verifies 11 mandatory administrative and structural items.

---

## 2. Backend Implementation Status & Verification Matrix

> [!NOTE]
> **Backend Implementation Status**:
> - **`ocr-parsing`** (Port 8002) is **100% IMPLEMENTED and LIVE** in Docker (RapidOCR + PyMuPDF FitZ fallback for scanned PDFs).

### 11 Mandatory Verification Elements

| Item # | Verification Element | Source Field | Target UI Visual Component |
| :--- | :--- | :--- | :--- |
| 1 | **Logo du Laboratoire** | Seal Classifier | Green Badge (`Logo Process Instruments Présent`) |
| 2 | **Logo d'Accréditation** | Seal Classifier | Green Badge (`Logo Accréditation Présent`) |
| 3 | **Numéro de Certificat** | Title Block OCR | Font-mono Badge (e.g. `ARRM13388-26`) |
| 4 | **Date d'Émission** | Metadata Block | Date Badge (e.g. `2026-07-29`) |
| 5 | **Date d'Étalonnage** | Metadata Block | Date Badge (e.g. `2026-07-29`) |
| 6 | **Date de Validation** | Sign Block | Date Badge (e.g. `2026-07-30`) |
| 7 | **Date Prochain Étalonnage** | Footer Block | Date Badge (e.g. `2027-07-29`) |
| 8 | **Conditions Ambiantes** | Ambient Block | Temp ($23.0^\circ\text{C}$) & HR ($50.0\%$) Card |
| 9 | **Responsable Étalonnage** | Sign Block | Operator Name (`Technicien Étalonneur`) |
| 10 | **Responsable Validation** | Sign Block | Validator Name (`Responsable Qualité`) |
| 11 | **Nombre de Pages** | Page Counter | Page Badge (e.g. `2/2 Pages`) |

---

## 3. UI Components List (`/ocr-inspector/[id]`)

1. **`DualCanvasPdfViewerComponent`**: Side-by-side view (PDF page vs color-coded OCR bounding boxes).
2. **`ExtractedMetadataInspectorComponent`**: Extracted text table with OCR confidence score % and manual correction input fields if confidence is $<90\%$.
3. **`SealAndLogoVerificationCardComponent`**: Badges confirming laboratory seal and accreditation logo presence.
