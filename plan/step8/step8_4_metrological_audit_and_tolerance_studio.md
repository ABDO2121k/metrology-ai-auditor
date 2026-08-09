# Step 8.4: ISO 17025 Metrological Audit & Tolerance Studio

## 1. Overview & Objectives

This sub-step specifies the **Metrological Audit & Decision Studio**, communicating directly with the **`metrology-engine`** microservice (Port 8003).

Per Section 4 of the ISO 17025 (NM 2018) project specifications, the engine verifies mathematical consistency, guard-band safety rules, reference standard validity, and hysteresis deltas across all 5 certificate models.

---

## 2. Core Metrological Rules Verified in Frontend UI

1. **Calculated Error & Correction**:
   $$\text{Erreur} = |\text{Valeur\_Mesurée} - \text{Valeur\_Référence}|$$
   $$\text{Correction} = \text{Valeur\_Référence} - \text{Valeur\_Mesurée}$$
2. **ISO 17025 Guard-Band Decision Rule**:
   $$\text{Conforme} \iff |\text{Correction}| + U \le \text{EMT}$$
   Where $U$ is expanded uncertainty ($k=2$, 95% confidence interval) and $\text{EMT}$ is Maximum Permissible Error limit.
3. **Reference Standard Validity Check**:
   $$\text{Date\_Étalonnage} \le \text{Date\_Expiration\_Étalon}$$
   If standard expired before calibration date, UI displays `ÉTALON EXPIRÉ (NON CONFORME)`.
4. **Dates Chronology Check**:
   $$\text{Réception} \le \text{Étalonnage} \le \text{Émission} \le \text{Validation}$$
5. **Hysteresis Delta Check**:
   $$\Delta_{\text{Hystérèse}} = |\text{Correction}_{\text{Retour}} - \text{Correction}_{\text{Aller}}| \le \text{Seuil}_{\text{Toléré}}$$

---

## 3. UI Components (`src/components/metrology_table.tsx`)

1. **Interactive Measurement Table**:
   - Columns: Point #, Consigne, Référence, Mesurée, Erreur Calculée, Correction, Incertitude $U$, EMT, Garde ($|\text{Corr}|+U$), Status Badge (`OK` / `NON CONFORME`).
2. **Environmental Conditions Status Card**:
   - Température: $23^\circ\text{C} \pm 2^\circ\text{C}$
   - Humidité Relatif: $\le 80\% \text{ HR}$
3. **Reference Standards Traceability Panel**:
   - Lists standard ID, calibration certificate number, and expiration status.
