package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"document-ingestion/models"
	"document-ingestion/services"
)

type ocrExtractedData struct {
	CertificateID        string `json:"certificate_id"`
	CertificateNumber    string `json:"certificate_number"`
	ClientName           string `json:"client_name"`
	InstrumentName       string `json:"instrument_name"`
	InstrumentSerial     string `json:"instrument_serial"`
	AnnouncedPageCount   int    `json:"announced_page_count"`
	ActualExtractedPages int    `json:"actual_extracted_pages"`
	IssueDate            string `json:"issue_date"`
	CalibrationDate      string `json:"calibration_date"`
	NextCalibrationDate  string `json:"next_calibration_date"`
	AmbientTemperature   string `json:"ambient_temperature"`
	AmbientHumidity      string `json:"ambient_humidity"`
}

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

	if _, err := file.Seek(0, 0); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to rewind uploaded file"})
	}

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

	if _, err := file.Seek(0, 0); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to rewind uploaded file"})
	}

	// 3. Upload Stream to MinIO S3
	certificateID := uuid.New().String()
	s3ObjectName := fmt.Sprintf("certificates/%s.pdf", certificateID)

	s3Path, err := services.UploadToMinIO(c.Context(), s3ObjectName, file, fileHeader.Size)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "MinIO S3 Storage failed: " + err.Error()})
	}

	userID := ""
	if userIDVal := c.Locals("user_id"); userIDVal != nil {
		if str, ok := userIDVal.(string); ok {
			userID = strings.TrimSpace(str)
		}
	}
	if userID == "" {
		userID = strings.TrimSpace(c.Get("X-User-ID"))
	}

	var uploadedBy *string
	if userID != "" {
		if _, err := uuid.Parse(userID); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid authenticated user context",
			})
		}
		uploadedBy = &userID
	}

	// 4. Save Record to PostgreSQL
	certRecord := models.Certificate{
		ID:                certificateID,
		CertificateNumber: fmt.Sprintf("TEMP-%s", certificateID[:8]),
		OriginalFilename:  fileHeader.Filename,
		FilePathS3:        s3Path,
		FileHashSHA256:    hashString,
		Status:            "PENDING_OCR",
		UploadedBy:        uploadedBy,
	}

	if err := services.DB.Create(&certRecord).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save database record: " + err.Error()})
	}

	// 5. Trigger OCR enrichment and persist extracted metadata
	if extracted, err := runOCRExtraction(certRecord.ID, certRecord.FilePathS3); err != nil {
		log.Printf("OCR extraction failed for certificate %s: %v", certRecord.ID, err)
	} else {
		certRecord.Status = "PROCESSING"
		certRecord.ClientName = extracted.ClientName
		certRecord.InstrumentName = extracted.InstrumentName
		certRecord.InstrumentSerial = extracted.InstrumentSerial
		certRecord.AnnouncedPageCount = extracted.AnnouncedPageCount
		certRecord.PageCount = extracted.ActualExtractedPages
		certRecord.AmbientTemperature = extracted.AmbientTemperature
		certRecord.AmbientHumidity = extracted.AmbientHumidity

		if extracted.CertificateNumber != "" {
			finalNumber := extracted.CertificateNumber
			var sameNumberCount int64
			services.DB.Model(&models.Certificate{}).
				Where("certificate_number = ? AND id <> ?", extracted.CertificateNumber, certRecord.ID).
				Count(&sameNumberCount)
			if sameNumberCount > 0 {
				finalNumber = fmt.Sprintf("%s-%s", extracted.CertificateNumber, certRecord.ID[:8])
			}
			certRecord.CertificateNumber = finalNumber
		}
		if parsed := parseOCRDateToTime(extracted.IssueDate); parsed != nil {
			certRecord.IssueDate = parsed
		}
		if parsed := parseOCRDateToTime(extracted.CalibrationDate); parsed != nil {
			certRecord.CalibrationDate = parsed
		}
		if parsed := parseOCRDateToTime(extracted.NextCalibrationDate); parsed != nil {
			certRecord.NextCalibrationDate = parsed
		}

		if err := services.DB.Save(&certRecord).Error; err != nil {
			log.Printf("Failed to persist OCR-enriched data for %s: %v", certRecord.ID, err)
		}
	}

	// 6. Fire events
	eventPayload := map[string]interface{}{
		"certificate_id": certRecord.ID,
		"s3_path":        s3Path,
		"file_name":      certRecord.OriginalFilename,
		"hash":           hashString,
	}
	services.PublishEvent("certificate:uploaded", eventPayload)
	if certRecord.Status == "PROCESSING" {
		services.PublishEvent("certificate:processed", map[string]interface{}{
			"certificate_id": certRecord.ID,
			"status":         certRecord.Status,
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":        "Certificate uploaded successfully",
		"certificate_id": certRecord.ID,
		"s3_path":        s3Path,
		"hash":           hashString,
		"status":         certRecord.Status,
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

// DeleteCertificate removes the certificate record and its object from MinIO
func DeleteCertificate(c *fiber.Ctx) error {
	id := c.Params("id")
	var cert models.Certificate
	if err := services.DB.First(&cert, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Certificate not found"})
	}

	// Attempt to delete object from MinIO (best-effort)
	if err := services.DeleteFromMinIO(c.Context(), cert.FilePathS3); err != nil {
		// Log but don't fail the delete entirely for user convenience
		log.Printf("Warning: failed to delete object from MinIO for %s: %v", cert.ID, err)
	}

	if err := services.DB.Delete(&models.Certificate{}, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete certificate record"})
	}

	services.PublishEvent("certificate:deleted", map[string]interface{}{"certificate_id": id})

	return c.JSON(fiber.Map{"message": "Certificate deleted"})
}

func runOCRExtraction(certificateID string, s3Path string) (*ocrExtractedData, error) {
	ocrServiceURL := os.Getenv("OCR_SERVICE_URL")
	if ocrServiceURL == "" {
		ocrServiceURL = "http://ocr-parsing:8002"
	}

	requestBody := fiber.Map{
		"certificate_id": certificateID,
		"s3_path":        s3Path,
	}
	payload, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Post(
		ocrServiceURL+"/api/v1/ocr/parse",
		"application/json",
		bytes.NewReader(payload),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("OCR service returned %d: %s", resp.StatusCode, string(respBody))
	}

	var extracted ocrExtractedData
	if err := json.Unmarshal(respBody, &extracted); err != nil {
		return nil, err
	}

	return &extracted, nil
}

func parseOCRDateToTime(value string) *time.Time {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return nil
	}
	parsed, err := time.Parse("2006-01-02", normalized)
	if err != nil {
		return nil
	}
	return &parsed
}
