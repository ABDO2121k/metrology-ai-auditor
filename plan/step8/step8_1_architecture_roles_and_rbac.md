# Step 8.1: Architecture, Authentication & Role-Based Access Control (RBAC)

## 1. Overview & Objectives

This sub-step defines the security, authentication, and Role-Based Access Control (RBAC) layer of the **`web-frontend`** Next.js 14 web application, integrating directly with the **`auth-gateway`** microservice (Port 8000).

Per the project specification and ISO/IEC 17025 standards (**PR.ECE V9** and **PRO.MDD V23**), the application strictly enforces distinct user roles and operational boundaries.

---

## 2. User Roles & Operational Responsibilities

| Role Name | System Key | Target User | Key Frontend Responsibilities & Permissions |
| :--- | :--- | :--- | :--- |
| **Technicien d'Étalonnage** | `ROLE_TECHNICIAN` | Calibration Technician | • Upload PDF certificates<br>• Review OCR extractions<br>• View preliminary metrological checks<br>• Cannot finalize or approve certificates |
| **Responsable de Validation** | `ROLE_VALIDATOR` | Quality Manager / Métrologiste Habilité | • Full access to Metrological Audit Studio<br>• Inspect AI Anomaly & Fraud flags<br>• Approve, sign, or reject certificates<br>• Trigger PDF audit report generation |
| **Administrateur Système** | `ROLE_ADMIN` | System Administrator | • Manage user accounts & RBAC roles<br>• Monitor microservices health matrix<br>• Inspect system audit logs & Redis queue metrics |

---

## 3. Communication Flow with `auth-gateway` (Port 8000)

```
[Next.js 14 Frontend (Port 3000)]
       │
       │  POST /api/v1/auth/login (username, password)
       ▼
┌─────────────────────────────────────────┐
│     auth-gateway Service (Port 8000)    │
│       (Go / Fiber JWT Issuer)           │
└────────────────────┬────────────────────┘
                     │ Returns JWT Token + User Role
                     ▼
[Frontend Storage: Secure HTTP-Only Cookie / LocalStorage]
       │
       │ Attach Header: Authorization: Bearer <token>
       ▼
┌─────────────────────────────────────────┐
│ All Protected Backend API Endpoints    │
│ (Ports 8001, 8002, 8003, 8004, 8005)    │
└─────────────────────────────────────────┘
```

---

## 4. UI Components & Layouts

1. **`src/app/login/page.tsx`**:
   - Modern Glassmorphism Login Card (`backdrop-blur-xl`).
   - Role selector demo dropdown (`Technicien`, `Responsable Validation`, `Admin`).
   - JWT token authentication state handler.
2. **`src/components/navbar.tsx`**:
   - Displays authenticated user profile, active role badge, and logout action.
   - Dynamic navigation items rendered strictly per active user role.
3. **`src/hooks/useAuth.ts`**:
   - React hook managing token validation, role checking, and automatic redirection for unauthorized routes.
