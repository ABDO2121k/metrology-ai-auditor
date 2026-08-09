# Step 8.2: Document Upload & Ingestion Studio

## 1. Overview & Objectives

This sub-step specifies the **PDF Upload & Ingestion Studio** component of the frontend (`/upload`), interacting directly with the **`document-ingestion`** microservice (Port 8001) and **MinIO S3 Storage** (`metrology-certificates` bucket).

Per procedure **PRO.MDD V23**, every uploaded PDF certificate must be cryptographically hashed (SHA-256), checked for duplicates, and indexed with exact metadata prior to automated OCR and metrological verification.

---

## 2. Ingestion Workflow & Microservice Integration

```
[User / Technician]
       │ Drag-and-Drop PDF File (e.g. ARRM13388-26.pdf)
       ▼
[Upload Studio UI (`/upload`)]
       │
       │ POST /api/v1/documents/upload (Multipart Form Data)
       ▼
┌────────────────────────────────────────────────────────┐
│     document-ingestion Service (Port 8001)             │
│  • Computes SHA-256 Checksum                            │
│  • Checks Redis Duplicate Cache                        │
│  • Streams PDF file to MinIO bucket: metrology-certs    │
│  • Emits Event to Redis Channel: certificate:uploaded  │
└────────────────────────────┬───────────────────────────┘
                             │ Returns Document ID + Status
                             ▼
[Frontend UI Progress State: Uploaded -> Queued for OCR]
```

---

## 3. UI Components & Features (`src/app/upload/page.tsx`)

1. **Drag-and-Drop Glassmorphism Dropzone**:
   - Accepts `.pdf` files up to 25 MB.
   - Interactive hover micro-animations & upload progress bar.
2. **Real-time Deduplication Alert**:
   - If the SHA-256 hash matches an existing document, the UI displays a duplicate warning badge (`FICHIER DÉJÀ EXISTANT DANS MINIO`).
3. **Batch Upload Queue**:
   - Supports uploading multiple certificate files simultaneously (e.g., uploading the 5 certificate models at once).
4. **Ingestion Metadata Form**:
   - Optional manual override fields: Equipment ID, Client Name, Department (Electrical).
