# EPIC 1: Multi-Role Authentication, RBAC & Security Infrastructure

## 1. Executive Summary & Vision

This Epic defines the **Security, Authentication, and Role-Based Access Control (RBAC)** architecture for the production-grade Web Application, integrating directly with **`auth-gateway`** (Port 8000).

Per ISO/IEC 17025:2017 (NM 2018) Articles 4 & 5, and procedures **PR.ECE V9** and **PRO.MDD V23**, access to calibration data, metrological validation studios, and electronic signatures must be strictly partitioned based on official qualifications and responsibilities.

---

## 2. Production Multi-Role Permission Matrix

```
                               ┌──────────────────────────────────────────┐
                               │           auth-gateway (Port 8000)       │
                               │        (JWT Issue & Middleware)          │
                               └────────────────────┬─────────────────────┘
                                                    │
         ┌──────────────────────┬───────────────────┴──────────────────┬──────────────────────┐
         ▼                      ▼                                      ▼                      ▼
┌──────────────────┐  ┌────────────────────────┐            ┌──────────────────┐   ┌──────────────────┐
│ ROLE_TECHNICIAN  │  │     ROLE_VALIDATOR     │            │  ROLE_DIRECTOR   │   │    ROLE_ADMIN    │
│  (Technicien)    │  │  (Resp. de Validation) │            │ (Directeur Labo) │   │   (Admin Sys)    │
└────────┬─────────┘  └───────────┬────────────┘            └────────┬─────────┘   └────────┬─────────┘
         │                        │                                  │                      │
         ├─ Upload PDF            ├─ Full Metrology Audit            ├─ Executive KPIs      ├─ System Health
         ├─ View OCR Extractions  ├─ Inspect AI Anomalies            ├─ Audit History Logs  ├─ Docker Status
         └─ Draft Verification    ├─ Approve / Sign Certificate      └─ Lab Analytics       └─ User Management
                                  └─ Reject Non-Conformities
```

### Detailed Role Definitions

1. **`ROLE_TECHNICIAN` (Technicien d'Étalonnage)**:
   - Performs physical calibration and document ingestion.
   - Access to `/upload`, `/ocr-inspector/[id]`, and preliminary certificate view.
   - **Restriction**: Cannot validate, sign, or issue official ISO 17025 certificates.

2. **`ROLE_VALIDATOR` (Responsable de Validation / Qualité - Métrologiste Habilité)**:
   - Authorized quality manager / validator per PR.ECE V9 Section 2.1.
   - Access to `/certificates/[id]` (Split-View Studio), `/eval-5certs`, `/reports`.
   - Full authority to approve/sign certificates ($|\text{Correction}| + U \le \text{EMT}$) or reject non-conformities.

3. **`ROLE_DIRECTOR` (Directeur du Laboratoire / Management)**:
   - High-level executive overview per ISO 17025 Section 8.
   - Access to `/director-dashboard` (Executive KPIs, compliance pass rates, anomaly trend analysis, lab throughput).

4. **`ROLE_ADMIN` (Administrateur Système)**:
   - IT operations and system maintenance.
   - Access to `/admin/health` (Microservices Matrix), `/admin/users` (User Account Provisioning), security log audit.

---

## 3. Page Routes & Security Components

### Routes Configuration
- **`/login`**: Glassmorphism login panel with MFA support and role selection.
- **`/auth/forgot-password`**: Secure password reset request workflow.
- **`/auth/verify-mfa`**: Multi-Factor Authentication TOTP verification.

### File Upload Security Specifications
- **MIME Type Validation**: Strict verification of `application/pdf` binary magic bytes (`%PDF-`).
- **File Hashing**: SHA-256 checksum calculated prior to MinIO stream ingestion.
- **Anti-Malware & Size Caps**: Enforces maximum file size limit of 25 MB and sanitizes document metadata.
- **CSRF & XSS Protection**: HTTP-Only SameSite cookies for JWT storage, preventing script injection.
