package handlers

import (
	"bytes"
	"context"
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
	"gorm.io/gorm"

	"document-ingestion/models"
	"document-ingestion/services"
)

// OCR of a multi-page scan takes tens of seconds. It runs in the background so
// the upload response is immediate; the client polls the certificate's status.
const ocrRequestTimeout = 5 * time.Minute

// ---------------------------------------------------------------------------
// OCR response shapes
// ---------------------------------------------------------------------------

type ocrMeasurement struct {
	PointIndex           int      `json:"point_index"`
	NominalValue         float64  `json:"nominal_value"`
	ReferenceValue       float64  `json:"reference_value"`
	MeasuredValue        float64  `json:"measured_value"`
	Unit                 string   `json:"unit"`
	Parameter            string   `json:"parameter"`
	CalculatedError      float64  `json:"calculated_error"`
	CalculatedCorrection float64  `json:"calculated_correction"`
	UncertaintyU         float64  `json:"uncertainty_u"`
	EMTLimit             float64  `json:"emt_limit"`
	GuardBandSum         float64  `json:"guard_band_sum"`
	IsReturnPoint        bool     `json:"is_return_point"`
	IsHysteresisValid    bool     `json:"is_hysteresis_valid"`
	IsConforme           bool     `json:"is_conforme"`
	RecordedError        *float64 `json:"recorded_error"`
}

type ocrAIValidation struct {
	ConfidenceScore          float64  `json:"confidence_score"`
	DataQualityScore         float64  `json:"data_quality_score"`
	MeasurementValidityScore float64  `json:"measurement_validity_score"`
	ExtractionQuality        string   `json:"extraction_quality"`
	CriticalIssues           []string `json:"critical_issues"`
	Warnings                 []string `json:"warnings"`
	Suggestions              []string `json:"suggestions"`
	ValidationPassed         bool     `json:"validation_passed"`
}

type ocrUniversalPayload struct {
	MetrologicalAudit struct {
		ConformityStatus string `json:"conformity_status"`
	} `json:"metrological_audit"`
	AIDecision struct {
		OverallStatus            string   `json:"overall_status"`
		ValidationRecommendation string   `json:"validation_recommendation"`
		BlockingAnomalies        []string `json:"blocking_anomalies"`
		Warnings                 []string `json:"warnings"`
	} `json:"ai_decision"`
}

type ocrExtractedData struct {
	CertificateID        string               `json:"certificate_id"`
	CertificateNumber    string               `json:"certificate_number"`
	ClientName           string               `json:"client_name"`
	InstrumentName       string               `json:"instrument_name"`
	InstrumentSerial     string               `json:"instrument_serial"`
	AnnouncedPageCount   int                  `json:"announced_page_count"`
	ActualExtractedPages int                  `json:"actual_extracted_pages"`
	IssueDate            string               `json:"issue_date"`
	CalibrationDate      string               `json:"calibration_date"`
	NextCalibrationDate  string               `json:"next_calibration_date"`
	AmbientTemperature   string               `json:"ambient_temperature"`
	AmbientHumidity      string               `json:"ambient_humidity"`
	Measurements         []ocrMeasurement     `json:"measurements"`
	AIValidation         *ocrAIValidation     `json:"ai_validation"`
	UniversalPayload     *ocrUniversalPayload `json:"universal_payload"`
	IsMocked             bool                 `json:"is_mocked"`
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

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

	// 1. PDF magic header check (%PDF-)
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

	// 2. SHA-256 duplicate check
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "SHA-256 hash generation failed"})
	}
	hashString := hex.EncodeToString(hasher.Sum(nil))

	var existing models.Certificate
	if err := services.DB.Where("file_hash_sha256 = ?", hashString).First(&existing).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":          "Duplicate certificate rejected. A file with identical SHA-256 content already exists.",
			"hash":           hashString,
			"certificate_id": existing.ID,
		})
	} else if err != gorm.ErrRecordNotFound {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Duplicate check failed: " + err.Error()})
	}

	if _, err := file.Seek(0, 0); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to rewind uploaded file"})
	}

	// 3. Stream to MinIO
	certificateID := uuid.New().String()
	s3ObjectName := fmt.Sprintf("certificates/%s.pdf", certificateID)

	s3Path, err := services.UploadToMinIO(c.Context(), s3ObjectName, file, fileHeader.Size)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "MinIO S3 storage failed: " + err.Error()})
	}

	userID := strings.TrimSpace(c.Get("X-User-ID"))
	if userID == "" {
		if v := c.Locals("user_id"); v != nil {
			if s, ok := v.(string); ok {
				userID = strings.TrimSpace(s)
			}
		}
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

	// 4. Persist the record before extraction so a crash mid-OCR still leaves a
	//    row the operator can retry, rather than an orphaned object in MinIO.
	certRecord := models.Certificate{
		ID:                certificateID,
		CertificateNumber: fmt.Sprintf("TEMP-%s", certificateID[:8]),
		OriginalFilename:  fileHeader.Filename,
		FilePathS3:        s3Path,
		FileHashSHA256:    hashString,
		Status:            models.StatusOCRProcessing,
		UploadedBy:        uploadedBy,
	}

	if err := services.DB.Create(&certRecord).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save database record: " + err.Error()})
	}

	services.PublishEvent("certificate:uploaded", map[string]interface{}{
		"certificate_id": certRecord.ID,
		"s3_path":        s3Path,
		"file_name":      certRecord.OriginalFilename,
		"hash":           hashString,
	})

	// 5. Extraction runs detached. A six-page scan needs ~30-60s of OCR, well
	//    past what a browser upload should be held open for.
	go processOCR(certRecord.ID, certRecord.FilePathS3)

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"message":        "Certificate uploaded. OCR extraction started.",
		"certificate_id": certRecord.ID,
		"s3_path":        s3Path,
		"hash":           hashString,
		"status":         certRecord.Status,
	})
}

// ---------------------------------------------------------------------------
// OCR orchestration
// ---------------------------------------------------------------------------

// processOCR extracts a certificate and persists the full result. It is safe to
// call repeatedly: each run replaces the previous measurement points and
// anomaly rows for that certificate.
func processOCR(certificateID, s3Path string) {
	extracted, rawPayload, err := runOCRExtraction(certificateID, s3Path)
	if err != nil {
		log.Printf("OCR extraction failed for certificate %s: %v", certificateID, err)
		services.DB.Model(&models.Certificate{}).
			Where("id = ?", certificateID).
			Updates(map[string]interface{}{
				"status":     models.StatusOCRFailed,
				"ocr_error":  err.Error(),
				"updated_at": time.Now(),
			})
		services.PublishEvent("certificate:ocr_failed", map[string]interface{}{
			"certificate_id": certificateID,
			"error":          err.Error(),
		})
		return
	}

	if err := persistExtraction(certificateID, extracted, rawPayload); err != nil {
		log.Printf("Failed to persist OCR result for %s: %v", certificateID, err)
		return
	}

	services.PublishEvent("certificate:processed", map[string]interface{}{
		"certificate_id": certificateID,
		"status":         models.StatusOCRCompleted,
	})
}

// persistExtraction writes the extraction, its measurement points and its
// anomalies in one transaction, so a partial failure cannot leave a
// certificate marked complete with no measurements behind it.
func persistExtraction(certificateID string, data *ocrExtractedData, raw []byte) error {
	return services.DB.Transaction(func(tx *gorm.DB) error {
		var cert models.Certificate
		if err := tx.First(&cert, "id = ?", certificateID).Error; err != nil {
			return err
		}

		cert.ClientName = data.ClientName
		cert.InstrumentName = data.InstrumentName
		cert.InstrumentSerial = data.InstrumentSerial
		cert.AnnouncedPageCount = data.AnnouncedPageCount
		cert.PageCount = data.ActualExtractedPages
		cert.AmbientTemperature = data.AmbientTemperature
		cert.AmbientHumidity = data.AmbientHumidity
		cert.OCRPayload = models.JSONDocument(raw)
		cert.OCRError = ""
		now := time.Now()
		cert.OCRCompletedAt = &now

		if data.AIValidation != nil {
			score := data.AIValidation.ConfidenceScore
			cert.OCRConfidence = &score
			cert.ExtractionQuality = data.AIValidation.ExtractionQuality
		}

		// The certificate number is unique, so a re-upload of the same document
		// under a different file must not collide with the existing row.
		if data.CertificateNumber != "" {
			finalNumber := data.CertificateNumber
			var clash int64
			tx.Model(&models.Certificate{}).
				Where("certificate_number = ? AND id <> ?", finalNumber, certificateID).
				Count(&clash)
			if clash > 0 {
				finalNumber = fmt.Sprintf("%s-%s", finalNumber, certificateID[:8])
			}
			cert.CertificateNumber = finalNumber
		}

		if parsed := parseOCRDateToTime(data.IssueDate); parsed != nil {
			cert.IssueDate = parsed
		}
		if parsed := parseOCRDateToTime(data.CalibrationDate); parsed != nil {
			cert.CalibrationDate = parsed
		}
		if parsed := parseOCRDateToTime(data.NextCalibrationDate); parsed != nil {
			cert.NextCalibrationDate = parsed
		}

		// Status reflects the audit verdict, not merely that OCR ran.
		cert.Status = models.StatusOCRCompleted
		if data.UniversalPayload != nil {
			cert.ConformityStatus = data.UniversalPayload.MetrologicalAudit.ConformityStatus
			if len(data.UniversalPayload.AIDecision.BlockingAnomalies) > 0 {
				cert.Status = models.StatusFlaggedAnomaly
			}
		}

		if err := tx.Save(&cert).Error; err != nil {
			return err
		}

		// Replace rather than append: a reprocess must not double the table.
		if err := tx.Where("certificate_id = ?", certificateID).
			Delete(&models.MeasurementPoint{}).Error; err != nil {
			return err
		}
		if err := tx.Where("certificate_id = ?", certificateID).
			Delete(&models.AnomalyAuditLog{}).Error; err != nil {
			return err
		}

		if len(data.Measurements) > 0 {
			points := make([]models.MeasurementPoint, 0, len(data.Measurements))
			for _, m := range data.Measurements {
				points = append(points, models.MeasurementPoint{
					CertificateID:        certificateID,
					PointIndex:           m.PointIndex,
					Unit:                 m.Unit,
					Parameter:            m.Parameter,
					NominalValue:         m.NominalValue,
					ReferenceValue:       m.ReferenceValue,
					MeasuredValue:        m.MeasuredValue,
					CalculatedError:      m.CalculatedError,
					CalculatedCorrection: m.CalculatedCorrection,
					ExpandedUncertaintyU: m.UncertaintyU,
					EMTLimit:             m.EMTLimit,
					GuardBandSum:         m.GuardBandSum,
					IsConforme:           m.IsConforme,
					IsReturnPoint:        m.IsReturnPoint,
					IsHysteresisValid:    m.IsHysteresisValid,
				})
			}
			if err := tx.Create(&points).Error; err != nil {
				return err
			}
		}

		if logs := anomalyLogsFrom(certificateID, data); len(logs) > 0 {
			if err := tx.Create(&logs).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// anomalyLogsFrom turns the audit's findings into rows the dashboard's anomaly
// breakdown can aggregate.
func anomalyLogsFrom(certificateID string, data *ocrExtractedData) []models.AnomalyAuditLog {
	if data.AIValidation == nil {
		return nil
	}

	confidence := data.AIValidation.ConfidenceScore * 100
	logs := make([]models.AnomalyAuditLog, 0)

	for _, issue := range data.AIValidation.CriticalIssues {
		logs = append(logs, models.AnomalyAuditLog{
			CertificateID:     certificateID,
			AnomalyType:       classifyAnomaly(issue),
			Severity:          "CRITICAL_BLOCKING",
			Description:       issue,
			AIConfidenceScore: confidence,
		})
	}
	for _, warning := range data.AIValidation.Warnings {
		logs = append(logs, models.AnomalyAuditLog{
			CertificateID:     certificateID,
			AnomalyType:       classifyAnomaly(warning),
			Severity:          "WARNING",
			Description:       warning,
			AIConfidenceScore: confidence,
		})
	}
	return logs
}

// classifyAnomaly buckets a free-text finding into the categories the dashboard
// charts, so the breakdown stays readable as wording evolves.
func classifyAnomaly(message string) string {
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "signature"):
		return "MISSING_SIGNATURE"
	case strings.Contains(lower, "stamp") || strings.Contains(lower, "seal"):
		return "MISSING_STAMP"
	case strings.Contains(lower, "page count"):
		return "PAGE_COUNT_MISMATCH"
	case strings.Contains(lower, "expired") || strings.Contains(lower, "standard"):
		return "EXPIRED_STANDARD"
	case strings.Contains(lower, "emt"):
		return "EMT_LIMIT_EXCEEDED"
	case strings.Contains(lower, "chronology") || strings.Contains(lower, "date"):
		return "CHRONOLOGY_ERROR"
	case strings.Contains(lower, "hysteresis"):
		return "HYSTERESIS_FAILURE"
	case strings.Contains(lower, "temperature") || strings.Contains(lower, "humidity"):
		return "ENVIRONMENT_OUT_OF_RANGE"
	case strings.Contains(lower, "missing") || strings.Contains(lower, "illegible"):
		return "EXTRACTION_INCOMPLETE"
	default:
		return "OTHER"
	}
}

func runOCRExtraction(certificateID, s3Path string) (*ocrExtractedData, []byte, error) {
	ocrServiceURL := os.Getenv("OCR_SERVICE_URL")
	if ocrServiceURL == "" {
		ocrServiceURL = "http://ocr-parsing:8002"
	}

	payload, err := json.Marshal(map[string]interface{}{
		"certificate_id": certificateID,
		"s3_path":        s3Path,
	})
	if err != nil {
		return nil, nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), ocrRequestTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, ocrServiceURL+"/api/v1/ocr/parse", bytes.NewReader(payload),
	)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{Timeout: ocrRequestTimeout}).Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, nil, fmt.Errorf("OCR service returned %d: %s", resp.StatusCode, truncate(string(respBody), 400))
	}

	var extracted ocrExtractedData
	if err := json.Unmarshal(respBody, &extracted); err != nil {
		return nil, nil, fmt.Errorf("could not decode OCR response: %w", err)
	}

	return &extracted, respBody, nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
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

// ---------------------------------------------------------------------------
// Read endpoints
// ---------------------------------------------------------------------------

func ListCertificates(c *fiber.Ctx) error {
	var certs []models.Certificate
	// The stored payload is large and the registry never renders it; omitting
	// it keeps the list response small.
	query := services.DB.
		Omit("ocr_payload").
		Order("created_at desc")

	if status := c.Query("status"); status != "" && status != "ALL" {
		query = query.Where("status = ?", status)
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(certificate_number) LIKE ? OR LOWER(original_filename) LIKE ? OR LOWER(client_name) LIKE ?",
			like, like, like,
		)
	}

	if err := query.Find(&certs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to query certificates"})
	}
	return c.JSON(certs)
}

func GetCertificateByID(c *fiber.Ctx) error {
	id := c.Params("id")
	var cert models.Certificate
	if err := services.DB.Omit("ocr_payload").First(&cert, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Certificate not found"})
	}
	return c.JSON(cert)
}

// GetCertificateOCR returns the stored extraction. It never triggers a new OCR
// run: viewing a certificate must not cost an extraction.
func GetCertificateOCR(c *fiber.Ctx) error {
	id := c.Params("id")

	var cert models.Certificate
	if err := services.DB.First(&cert, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Certificate not found"})
	}

	var points []models.MeasurementPoint
	services.DB.Where("certificate_id = ?", id).Order("point_index asc").Find(&points)

	var anomalies []models.AnomalyAuditLog
	services.DB.Where("certificate_id = ?", id).Order("severity asc").Find(&anomalies)

	response := fiber.Map{
		"certificate_id":     cert.ID,
		"status":             cert.Status,
		"extraction_quality": cert.ExtractionQuality,
		"ocr_confidence":     cert.OCRConfidence,
		"conformity_status":  cert.ConformityStatus,
		"ocr_error":          cert.OCRError,
		"ocr_completed_at":   cert.OCRCompletedAt,
		"measurements":       points,
		"anomalies":          anomalies,
	}

	if !cert.OCRPayload.IsEmpty() {
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(cert.OCRPayload), &payload); err == nil {
			response["extraction"] = payload
		}
	}

	return c.JSON(response)
}

// ReprocessCertificate re-runs extraction for a certificate whose OCR failed or
// whose result predates an engine change.
func ReprocessCertificate(c *fiber.Ctx) error {
	id := c.Params("id")

	var cert models.Certificate
	if err := services.DB.First(&cert, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Certificate not found"})
	}

	if cert.Status == models.StatusOCRProcessing && cert.OCRCompletedAt == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Extraction is already running for this certificate",
		})
	}

	services.DB.Model(&cert).Updates(map[string]interface{}{
		"status":    models.StatusOCRProcessing,
		"ocr_error": "",
	})

	go processOCR(cert.ID, cert.FilePathS3)

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"message":        "Re-extraction started",
		"certificate_id": cert.ID,
		"status":         models.StatusOCRProcessing,
	})
}

func DeleteCertificate(c *fiber.Ctx) error {
	id := c.Params("id")
	var cert models.Certificate
	if err := services.DB.First(&cert, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Certificate not found"})
	}

	// Best-effort: a stale object in MinIO is preferable to a row the operator
	// cannot remove from the registry.
	if err := services.DeleteFromMinIO(c.Context(), cert.FilePathS3); err != nil {
		log.Printf("Warning: failed to delete object from MinIO for %s: %v", cert.ID, err)
	}

	if err := services.DB.Delete(&models.Certificate{}, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete certificate record"})
	}

	services.PublishEvent("certificate:deleted", map[string]interface{}{"certificate_id": id})

	return c.JSON(fiber.Map{"message": "Certificate deleted"})
}

// GetStats powers the dashboard KPI row from real rows rather than constants.
func GetStats(c *fiber.Ctx) error {
	type statusCount struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}

	var counts []statusCount
	services.DB.Model(&models.Certificate{}).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&counts)

	var total int64
	services.DB.Model(&models.Certificate{}).Count(&total)

	byStatus := make(map[string]int64, len(counts))
	for _, row := range counts {
		byStatus[row.Status] = row.Count
	}

	var totalPoints int64
	services.DB.Model(&models.MeasurementPoint{}).Count(&totalPoints)

	// Compliance is only meaningful over points that were actually judged. A
	// certificate read without column headers is stored as INDETERMINE and its
	// points carry is_conforme = true because no verdict was reached - counting
	// those would report near-100% compliance for work nobody has checked.
	const decided = `
		EXISTS (
			SELECT 1 FROM certificates c
			WHERE c.id = measurement_points.certificate_id
			  AND c.conformity_status IN ('CONFORME', 'NON_CONFORME')
		)`

	var judgedPoints, conformePoints int64
	services.DB.Model(&models.MeasurementPoint{}).Where(decided).Count(&judgedPoints)
	services.DB.Model(&models.MeasurementPoint{}).
		Where(decided).
		Where("is_conforme = ?", true).
		Count(&conformePoints)

	compliance := 0.0
	if judgedPoints > 0 {
		compliance = float64(conformePoints) / float64(judgedPoints) * 100.0
	}

	// Certificates awaiting a human decision because the audit could not reach
	// one on its own.
	var undecidedCertificates int64
	services.DB.Model(&models.Certificate{}).
		Where("conformity_status = ?", "INDETERMINE").
		Count(&undecidedCertificates)

	var anomalyCount int64
	services.DB.Model(&models.AnomalyAuditLog{}).
		Where("severity = ?", "CRITICAL_BLOCKING").
		Count(&anomalyCount)

	return c.JSON(fiber.Map{
		"total_certificates":  total,
		"by_status":           byStatus,
		"pending":             byStatus[models.StatusPendingOCR] + byStatus[models.StatusOCRProcessing],
		"completed":           byStatus[models.StatusOCRCompleted],
		"failed":              byStatus[models.StatusOCRFailed],
		"flagged":             byStatus[models.StatusFlaggedAnomaly],
		"validated":           byStatus[models.StatusValidated],
		"total_points":           totalPoints,
		"judged_points":          judgedPoints,
		"conforme_points":        conformePoints,
		"compliance_percent":     compliance,
		"blocking_anomalies":     anomalyCount,
		"undecided_certificates": undecidedCertificates,
	})
}
