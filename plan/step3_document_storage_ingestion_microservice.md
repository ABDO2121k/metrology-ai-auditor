# Step 3: Document Storage & Ingestion Microservice (`document-ingestion`)

## 1. Objective & Scope

Design and build the **Document Storage & Ingestion Microservice** (`document-ingestion`) in **Go**.

This microservice handles high-speed PDF certificate uploads, validates file integrity against PRO.MDD V23 standard operating procedures, prevents duplicate certificate submissions via cryptographic SHA-256 fingerprinting, stores binary PDF objects in MinIO object storage, and fires async ingestion events to downstream OCR services.

---

## 2. Technical Requirements & Standards Compliance

- **SHA-256 Duplicate Check**: Calculate SHA-256 digest of uploaded PDF before saving. If hash matches an existing record in PostgreSQL, reject upload immediately with `409 Conflict` error ("Duplicate Certificate").
- **MIME & Header Verification**: Validate file bytes start with magic header `%PDF-`. Reject non-PDF MIME spoofing.
- **S3 MinIO Integration**: Direct multipart streaming upload to MinIO bucket `metrology-certificates`.
- **Event Bus Dispatch**: Publish JSON message to Redis topic `certificate:uploaded` containing `certificate_id`, `s3_path`, and `user_id`.

---

## 3. Microservice Project Layout (`app/services/document-ingestion/`)

```
document-ingestion/
├── main.go
├── go.mod
├── go.sum
├── Dockerfile
├── services/
│   ├── minio_service.go
│   ├── hashing_service.go
│   └── event_publisher.go
├── handlers/
│   └── upload_handler.go
└── models/
    └── certificate_metadata.go
```

---

## 4. Implementation Details

### 4.1 Ingestion & Upload Handler (`handlers/upload_handler.go`)

```go
package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"document-ingestion/models"
	"document-ingestion/services"
)

func UploadCertificate(c *fiber.Ctx) error {
	// 1. Get uploaded file from multipart header
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "PDF file is required"})
	}

	// 2. Open file stream
	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read file"})
	}
	defer file.Close()

	// 3. Read first 1024 bytes for PDF magic header check
	buf := make([]byte, 1024)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid file content"})
	}
	if string(buf[:5]) != "%PDF-" {
		return c.Status(fiber.StatusUnsupportedMediaType).JSON(fiber.Map{"error": "Only valid PDF files are accepted"})
	}

	// Reset stream offset
	file.Seek(0, 0)

	// 4. Calculate SHA-256 Fingerprint
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Hash generation failed"})
	}
	hashString := hex.EncodeToString(hasher.Sum(nil))

	// Check duplicate in PostgreSQL
	var existingCount int64
	services.DB.Model(&models.Certificate{}).Where("file_hash_sha256 = ?", hashString).Count(&existingCount)
	if existingCount > 0 {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Duplicate certificate rejected. A file with identical content already exists.",
			"hash":  hashString,
		})
	}

	// Reset stream offset for S3 upload
	file.Seek(0, 0)

	// 5. Stream file to MinIO S3 Bucket
	certificateID := uuid.New().String()
	s3ObjectName := fmt.Sprintf("certificates/%s.pdf", certificateID)

	s3Path, err := services.UploadToMinIO(c.Context(), s3ObjectName, file, fileHeader.Size)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "S3 Storage failed: " + err.Error()})
	}

	// 6. Save Certificate Record to Database
	userID := c.Locals("user_id").(string)
	certRecord := models.Certificate{
		ID:               certificateID,
		OriginalFilename: fileHeader.Filename,
		FilePathS3:       s3Path,
		FileHashSHA256:   hashString,
		Status:           "PENDING_OCR",
		UploadedBy:       userID,
	}

	if err := services.DB.Create(&certRecord).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save record"})
	}

	// 7. Publish Event to Redis Queue for async OCR processing
	eventData := map[string]interface{}{
		"certificate_id": certRecord.ID,
		"s3_path":        s3Path,
		"file_name":      certRecord.OriginalFilename,
	}
	services.PublishEvent("certificate:uploaded", eventData)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":        "Certificate uploaded successfully",
		"certificate_id": certRecord.ID,
		"s3_path":        s3Path,
		"hash":           hashString,
		"status":         "PENDING_OCR",
	})
}
```

---

### 4.2 API Specification (`POST /api/v1/certificates/upload`)

#### Request Header:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

#### Form Parameters:
- `file`: `Certif 1.pdf` (Binary PDF file)

#### Successful Response (`201 Created`):
```json
{
  "message": "Certificate uploaded successfully",
  "certificate_id": "c7a2b910-4e3a-4a21-8b01-5d93e1176b9e",
  "s3_path": "metrology-certificates/certificates/c7a2b910-4e3a-4a21-8b01-5d93e1176b9e.pdf",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "status": "PENDING_OCR"
}
```

#### Error Response (`409 Conflict`):
```json
{
  "error": "Duplicate certificate rejected. A file with identical content already exists.",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

---

## 5. Verification Checklist

- [ ] Upload `Certif 1.pdf` via `POST /api/v1/certificates/upload`. Verify `201 Created`.
- [ ] Attempt uploading `Certif 1.pdf` a second time. Verify `409 Conflict` duplicate rejection.
- [ ] Attempt uploading a `.jpg` or `.txt` file renamed to `.pdf`. Verify `415 Unsupported Media Type` (magic header check).
- [ ] Check MinIO bucket `metrology-certificates` to confirm the PDF object was persisted correctly.
