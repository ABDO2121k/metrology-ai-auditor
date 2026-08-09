# EPIC 1: User Provisioning, Multi-Role Auth (RBAC), Smart Redirection & Password Security

## 1. Executive Summary & Vision

This Epic specifies the **User Provisioning, Smart Redirection, Dynamic Layout, and Password Security Architecture** for the Next.js 14 Web Application, integrating directly with **`auth-gateway`** (Port 8000).

Per ISO/IEC 17025:2017 Articles 4, 5, 6 & 8, and procedures **PR.ECE V9** and **PRO.MDD V23**, user provisioning, authentication, and role boundaries are strictly governed.

---

## 2. Global Root Admin Database Initialization & Seeding

> [!IMPORTANT]
> **Backend GORM Initialization & Root Admin Provisioning**:
> - Whenever `auth-gateway` initializes, it automatically executes GORM `AutoMigrate(&models.User{})`.
> - **Default Root Admin Provisioning**: Reads global environment variables `DEFAULT_ADMIN_USERNAME` (default `admin`) and `DEFAULT_ADMIN_PASSWORD` (default `AdminSecret123!`) from `.env`.
> - If no root administrator exists, it hashes the password with `bcrypt` and provisions the root user with `RoleAdministrator` (`ADMINISTRATOR`).
> - **Self-registration is strictly DISABLED** to prevent unauthorized access. Only `ADMINISTRATOR` can create new users via `POST /api/v1/admin/users/register`.

```
                        ┌────────────────────────────────────────────────────┐
                        │   .env Global Environment Configuration            │
                        │   • DEFAULT_ADMIN_USERNAME=admin                   │
                        │   • DEFAULT_ADMIN_PASSWORD=AdminSecret123!         │
                        └─────────────────────────┬──────────────────────────┘
                                                  │
                                                  ▼
                        ┌────────────────────────────────────────────────────┐
                        │   auth-gateway DB Init (config.InitConfig())       │
                        │   • AutoMigrate(&models.User{})                    │
                        │   • Seed Default Root Admin Account                │
                        └─────────────────────────┬──────────────────────────┘
                                                  │
         ┌──────────────────────┬─────────────────┴──────────────────┬──────────────────────┐
         ▼                      ▼                                    ▼                      ▼
┌──────────────────┐  ┌────────────────────────┐          ┌──────────────────┐   ┌──────────────────┐
│ Role: TECHNICIAN │  │    Role: VALIDATOR     │          │  Role: DIRECTOR  │   │ Role: ADMIN      │
│ (Technicien Étal)│  │ (Resp. de Validation)  │          │ (Directeur Labo) │   │ (Admin Sys)      │
└──────────────────┘  └────────────────────────┘          └──────────────────┘   └──────────────────┘
```

---

## 3. Smart Redirection & Dynamic Dashboard Layout

### 3.1 Smart Redirection Logic
Upon successful login (`POST /api/v1/auth/login`), the frontend inspects the JWT payload role claim and automatically redirects the user to their role-specific landing page:

- **`TECHNICIAN`** $\longrightarrow$ Redirection to **`/upload`** (File Upload Studio).
- **`VALIDATOR`** $\longrightarrow$ Redirection to **`/certificates`** (Certificate Audit Grid & Split-View Studio).
- **`DIRECTOR`** $\longrightarrow$ Redirection to **`/director-dashboard`** (Executive Analytics & Charts).
- **`ADMINISTRATOR`** $\longrightarrow$ Redirection to **`/admin/users`** (User Account Provisioning & System Health).

### 3.2 Dynamic Dashboard Layout (Topbar + Dynamic Sidebar)
- **Topbar**: Displays Process Instruments logo, active user name, role badge (`ROLE_TECHNICIAN`, `ROLE_VALIDATOR`, `ROLE_DIRECTOR`, `ROLE_ADMINISTRATOR`), self-service Profile Modal trigger, and Logout button.
- **Dynamic Sidebar**: Conditionally renders menu items based on active JWT claims:
  - `TECHNICIAN`: Upload Studio (`/upload`), My Uploads (`/certificates`).
  - `VALIDATOR`: Audit Register (`/certificates`), 5 Certs Studio (`/eval-5certs`), Reports (`/reports`).
  - `DIRECTOR`: Executive Dashboard (`/director-dashboard`), Audit Logs (`/reports`).
  - `ADMINISTRATOR`: User Management (`/admin/users`), System Health Matrix (`/admin/health`).

---

## 4. Password Management System (Dual Flows)

Per ISO 17025 security requirements, the platform implements two distinct password update flows:

### Flow A: Admin Override (`ROLE_ADMINISTRATOR`)
- **Backend API**: `PUT /api/v1/admin/users/:id/reset-password` (Requires `ADMINISTRATOR` JWT role).
- **Frontend UI Component**: `AdminResetPasswordModal` on `/admin/users` page allowing the system administrator to force-reset any user's password.

### Flow B: Self-Service Profile Flow (Any Authenticated User)
- **Backend API**: `PUT /api/v1/auth/change-password` (Requires valid JWT token).
- **Frontend UI Component**: `SelfServicePasswordModal` accessible from Topbar user profile dropdown, requiring current password verification before saving new password.

---

## 5. File Upload Security Specifications

- **MIME Magic Byte Verification**: Validates `%PDF-` header bytes before ingestion.
- **SHA-256 Checksum**: Calculates file hash to prevent duplicate uploads.
- **Size Limit**: Enforces 25 MB max file size cap.
- **JWT Storage**: HTTP-Only SameSite cookies preventing script injection.
