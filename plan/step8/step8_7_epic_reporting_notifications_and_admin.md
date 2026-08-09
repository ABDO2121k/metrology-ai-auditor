# EPIC 7: Reporting, Notifications & System Administration Studio

## 1. Executive Summary & Vision

This Epic specifies the **Audit Reporting, Notification Stream, and System Administration Studio**, communicating with **`reporting-notification`** (Port 8005), **PostgreSQL 16**, and **MinIO S3 Storage** (`audit-reports` bucket).

Per procedure **PRO.MDD V23**, all formal PDF audit reports must be archived in MinIO S3 storage, real-time events broadcast via WebSockets, and system microservices monitored.

---

## 2. Backend Support & Password Override Management

> [!NOTE]
> **Backend Implementation Status**:
> - **`auth-gateway`** (Port 8000) exposes `GET /api/v1/admin/users`, `POST /api/v1/admin/users/register`, and `PUT /api/v1/admin/users/:id/reset-password` (restricted to `ADMINISTRATOR`).
> - **`reporting-notification`** (Port 8005) is **100% IMPLEMENTED and LIVE** in Docker (Fastify + PDFKit + `@fastify/websocket` + `ioredis` Pub/Sub + MinIO S3 SDK).

```
[reporting-notification Service (Port 8005)]
       │
       │ WebSocket Broadcast Stream (ws://localhost:8005/ws/notifications)
       ▼
[Frontend Notification Hook (`useWebSocket.ts`)]
       │
       ├── Event: "certificate:processed"     --> Updates Dashboard Counters
       ├── Event: "certificate:anomaly_flagged"--> Displays Toast Warning Alert
       └── Event: "report:generated"          --> Enables PDF Download Button
```

---

## 3. UI Components List (`/reports`, `/admin/health`, `/admin/users`)

1. **`PdfReportGeneratorModalComponent`**: Preview modal rendering ISO/IEC 17025 formal PDF audit report.
2. **`MinioDownloadStudioComponent`**: Direct download button fetching stored PDF audit report from MinIO bucket `audit-reports`.
3. **`WebSocketLiveNotificationFeedComponent`**: Real-time toast notifications for newly uploaded or flagged certificates.
4. **`MicroservicesHealthMatrixComponent`** (`/admin/health`): Status indicators for all system services (`auth-gateway:8000`, `document-ingestion:8001`, `ocr-parsing:8002`, `metrology-engine:8003`, `ai-anomaly:8004`, `reporting-notification:8005`, `postgres:5432`, `redis:6379`, `minio:9000`).
5. **`UserAccountManagementTableComponent`** (`/admin/users`): User account creation (`POST /api/v1/admin/users/register`) and role assignment table managed by `ADMINISTRATOR`.
6. **`AdminPasswordResetModalComponent`** (`/admin/users`): Modal allowing `ADMINISTRATOR` to force-update/reset any target user's password (`PUT /api/v1/admin/users/:id/reset-password`).
