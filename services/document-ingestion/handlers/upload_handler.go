package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"document-ingestion/models"
	"document-ingestion/services"
)

func UploadCertificate(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "PDF file is required"})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read file"})
	}
	defer file.Close()

	// 1. PDF Magic Header Check (%PDF-)
	buf := make([]byte, 1024)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid file content"})
	}
	if n < 5 || string(buf[:5]) != "%PDF-" {
		return c.Status(fiber.StatusUnsupportedMediaType).JSON(fiber.Map{"error": "Only valid PDF files (%PDF-) are accepted"})
	}

	file.Seek(0, 0)

	// 2. Cryptographic SHA-256 Digest Duplicate Check
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "SHA-256 Hash generation failed"})
	}
	hashString := hex.EncodeToString(hasher.Sum(nil))

	var existingCount int64
	services.DB.Model(&models.Certificate{}).Where("file_hash_sha256 = ?", hashString).Count(&existingCount)
	if existingCount > 0 {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Duplicate certificate rejected. A file with identical SHA-256 content already exists.",
			"hash":  hashString,
		})
	}

	file.Seek(0, 0)

	// 3. Upload Stream to MinIO S3
	certificateID := uuid.New().String()
	s3ObjectName := fmt.Sprintf("certificates/%s.pdf", certificateID)

	s3Path, err := services.UploadToMinIO(c.Context(), s3ObjectName, file, fileHeader.Size)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "MinIO S3 Storage failed: " + err.Error()})
	}

	userIDVal := c.Locals("user_id")
	userID := ""
	if userIDVal != nil {
		userID = userIDVal.(string)
	}

	// 4. Save Record to PostgreSQL
	certRecord := models.Certificate{
		ID:                certificateID,
		CertificateNumber: fmt.Sprintf("TEMP-%s", certificateID[:8]),
		OriginalFilename:  fileHeader.Filename,
		FilePathS3:        s3Path,
		FileHashSHA256:    hashString,
		Status:            "PENDING_OCR",
		UploadedBy:        userID,
	}

	if err := services.DB.Create(&certRecord).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save database record: " + err.Error()})
	}

	// 5. Fire Event to Redis Queue for async OCR service
	eventPayload := map[string]interface{}{
		"certificate_id": certRecord.ID,
		"s3_path":        s3Path,
		"file_name":      certRecord.OriginalFilename,
		"hash":           hashString,
	}
	services.PublishEvent("certificate:uploaded", eventPayload)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":        "Certificate uploaded successfully",
		"certificate_id": certRecord.ID,
		"s3_path":        s3Path,
		"hash":           hashString,
		"status":         "PENDING_OCR",
	})
}

func ListCertificates(c *fiber.Ctx) error {
	var certs []models.Certificate
	if err := services.DB.Order("created_at desc").Find(&certs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to query certificates"})
	}
	return c.JSON(certs)
}

func GetCertificateByID(c *fiber.Ctx) error {
	id := c.Params("id")
	var cert models.Certificate
	if err := services.DB.First(&cert, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Certificate not found"})
	}
	return c.JSON(cert)
}
