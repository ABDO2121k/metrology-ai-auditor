# EPIC 4: ISO 17025 Metrological Verification & Split-View Studio

## 1. Executive Summary & Vision

This Epic specifies the **Split-View Metrological Audit Studio** (`/certificates/[id]`), communicating directly with **`metrology-engine`** (Port 8003).

Per Section 4 of ISO 17025 (NM 2018) and **PR.ECE V9**, the engine verifies mathematical consistency, hysteresis, reference standards validity, and guard-band decision rules across all 5 certificate models.

---

## 2. Backend Implementation Status & Math Formulas

> [!NOTE]
> **Backend Implementation Status**:
> - **`metrology-engine`** (Port 8003) is **100% IMPLEMENTED and LIVE** in Docker (Handles guard-band rules, hysteresis, standard validity across all 5 certificate models).

1. **Calculated Error & Correction**:
   $$\text{Erreur} = |\text{Valeur\_Mesurée} - \text{Valeur\_Référence}|$$
   $$\text{Correction} = \text{Valeur\_Référence} - \text{Valeur\_Mesurée}$$
2. **ISO 17025 Guard-Band Compliance Rule**:
   $$\text{Conforme} \iff |\text{Correction}| + U \le \text{EMT}$$
3. **Reference Standard Validity Check**:
   $$\text{Date\_Étalonnage} \le \text{Date\_Expiration\_Étalon}$$
4. **Hysteresis & Repeatability Check**:
   $$\Delta_{\text{Hystérèse}} = |\text{Correction}_{\text{Retour}} - \text{Correction}_{\text{Aller}}| \le \text{Seuil}_{\text{Toléré}}$$

---

## 3. UI Components List (`/certificates/[id]`)

1. **`SplitViewPdfInspectorComponent`**: Left panel (5 cols) embedded PDF viewer + Right panel (7 cols) metrology workspace.
2. **`Iso17025MathTableComponent`**: Interactive measurement table ($|\text{Corr}|+U \le \text{EMT}$).
3. **`ReferenceStandardsTrackerComponent`**: Standard ID, calibration date, and expiration status indicator.
4. **`ValidatorActionFooterComponent`**: 1-click **Valider & Signer (ISO 17025)** and **Rejeter** action buttons.
