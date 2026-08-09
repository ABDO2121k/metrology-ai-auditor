# EPIC 2: Document Upload & Ingestion Studio (PRO.MDD V23)

## 1. Executive Summary & Vision

This Epic specifies the **PDF Upload & Ingestion Studio** (`/upload`), communicating directly with **`document-ingestion`** (Port 8001) and **MinIO S3 Storage** (`metrology-certificates` bucket).

Per procedure **PRO.MDD V23**, all calibration certificates must follow strict codification rules, cryptographic deduplication (SHA-256), and metadata tagging prior to OCR parsing.

---

## 2. Ingestion Workflow & Microservice Status Verification

> [!NOTE]
> **Backend Implementation Status**:
> - **`document-ingestion`** (Port 8001) is **100% IMPLEMENTED and LIVE** in Docker.
> - Handles SHA-256 checksum calculation, MinIO S3 streaming upload, and Redis pub-sub event publishing (`certificate:uploaded`).

```
[Drag & Drop Zone UI] ───► [SHA-256 Hash Check] ───► [POST /api/v1/documents/upload]
                                                           │
                                                           ▼
                                              ┌───────────────────────────┐
                                              │ document-ingestion:8001   │
                                              │ • MinIO S3 Stream Upload  │
                                              │ • Redis Event Channel     │
                                              └───────────────────────────┘
```

---

## 3. UI Components Breakdown (`/upload`)

1. **`DragDropDropzoneComponent`**: Drag & drop zone accepting `.pdf` files up to 25MB.
2. **`DeduplicationBannerComponent`**: Displays warning if SHA-256 hash exists in MinIO.
3. **`CodificationGridFormComponent`**: Form fields for document codification grid per PRO.MDD V23 (Department: Electrical, Equipment ID, Customer Name).
4. **`BatchUploadQueueComponent`**: Enables batch uploading multiple certificates simultaneously.
