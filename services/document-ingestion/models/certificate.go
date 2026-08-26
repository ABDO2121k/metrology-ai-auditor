package models

import (
	"database/sql/driver"
	"fmt"
	"strings"
	"time"
)

// Certificate status lifecycle:
//
//	PENDING_OCR    -> queued, extraction not started
//	OCR_PROCESSING -> extraction running
//	OCR_COMPLETED  -> extraction stored, ready for review
//	OCR_FAILED     -> extraction errored; retry via POST /:id/reprocess
//	FLAGGED_ANOMALY / VALIDATED_CONFORME / REJECTED_NON_CONFORME -> audit verdicts
const (
	StatusPendingOCR    = "PENDING_OCR"
	StatusOCRProcessing = "OCR_PROCESSING"
	StatusOCRCompleted  = "OCR_COMPLETED"
	StatusOCRFailed     = "OCR_FAILED"
	StatusFlaggedAnomaly = "FLAGGED_ANOMALY"
	StatusValidated      = "VALIDATED_CONFORME"
	StatusRejected       = "REJECTED_NON_CONFORME"
)

// JSONDocument is a JSON value held in a jsonb column.
//
// Postgres rejects the empty string as invalid JSON, so a Go string cannot be
// mapped straight onto jsonb: inserting a record before its payload exists
// sends '' and fails the whole INSERT with
//
//	invalid input syntax for type json (SQLSTATE 22P02)
//
// which is exactly what happened to every upload, because the certificate row
// is deliberately created before extraction runs. Writing NULL for an empty
// value is the correct representation of "no payload yet".
type JSONDocument string

// Value implements driver.Valuer.
func (j JSONDocument) Value() (driver.Value, error) {
	if strings.TrimSpace(string(j)) == "" {
		return nil, nil
	}
	return string(j), nil
}

// Scan implements sql.Scanner.
func (j *JSONDocument) Scan(src interface{}) error {
	switch v := src.(type) {
	case nil:
		*j = ""
	case []byte:
		*j = JSONDocument(v)
	case string:
		*j = JSONDocument(v)
	default:
		return fmt.Errorf("cannot scan %T into JSONDocument", src)
	}
	return nil
}

// IsEmpty reports whether there is any payload to decode.
func (j JSONDocument) IsEmpty() bool {
	return strings.TrimSpace(string(j)) == ""
}

type Certificate struct {
	ID                  string     `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CertificateNumber   string     `gorm:"column:certificate_number;uniqueIndex" json:"certificate_number"`
	OriginalFilename    string     `gorm:"column:original_filename;not null" json:"original_filename"`
	FilePathS3          string     `gorm:"column:file_path_s3;not null" json:"file_path_s3"`
	FileHashSHA256      string     `gorm:"column:file_hash_sha256;uniqueIndex;not null" json:"file_hash_sha256"`
	Status              string     `gorm:"type:certificate_status;default:'PENDING_OCR'" json:"status"`
	PageCount           int        `gorm:"column:page_count;default:0" json:"page_count"`
	AnnouncedPageCount  int        `gorm:"column:announced_page_count;default:0" json:"announced_page_count"`
	ClientName          string     `gorm:"column:client_name" json:"client_name"`
	InstrumentName      string     `gorm:"column:instrument_name" json:"instrument_name"`
	InstrumentSerial    string     `gorm:"column:instrument_serial" json:"instrument_serial"`
	IssueDate           *time.Time `gorm:"column:issue_date" json:"issue_date"`
	CalibrationDate     *time.Time `gorm:"column:calibration_date" json:"calibration_date"`
	NextCalibrationDate *time.Time `gorm:"column:next_calibration_date" json:"next_calibration_date"`
	AmbientTemperature  string     `gorm:"column:ambient_temperature" json:"ambient_temperature"`
	AmbientHumidity     string     `gorm:"column:ambient_humidity" json:"ambient_humidity"`

	// The complete extraction, stored so the detail view can render results
	// without re-running a multi-second OCR pass on every page load. Excluded
	// from JSON responses: callers read it through GET /:id/ocr, which decodes
	// it. Empty is written as NULL - see JSONDocument.
	OCRPayload        JSONDocument   `gorm:"column:ocr_payload;type:jsonb" json:"-"`
	OCRConfidence     *float64       `gorm:"column:ocr_confidence" json:"ocr_confidence"`
	ExtractionQuality string         `gorm:"column:extraction_quality" json:"extraction_quality"`
	ConformityStatus  string         `gorm:"column:conformity_status" json:"conformity_status"`
	OCRError          string         `gorm:"column:ocr_error" json:"ocr_error,omitempty"`
	OCRCompletedAt    *time.Time     `gorm:"column:ocr_completed_at" json:"ocr_completed_at"`

	UploadedBy  *string   `gorm:"column:uploaded_by" json:"uploaded_by"`
	ValidatedBy *string   `gorm:"column:validated_by" json:"validated_by"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (Certificate) TableName() string {
	return "certificates"
}

// MeasurementPoint is one audited row of a certificate's measurement table.
type MeasurementPoint struct {
	ID                   string    `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CertificateID        string    `gorm:"column:certificate_id;index" json:"certificate_id"`
	PointIndex           int       `gorm:"column:point_index" json:"point_index"`
	Unit                 string    `gorm:"column:unit" json:"unit"`
	Parameter            string    `gorm:"column:parameter" json:"parameter"`
	NominalValue         float64   `gorm:"column:nominal_value" json:"nominal_value"`
	ReferenceValue       float64   `gorm:"column:reference_value" json:"reference_value"`
	MeasuredValue        float64   `gorm:"column:measured_value" json:"measured_value"`
	CalculatedError      float64   `gorm:"column:calculated_error" json:"calculated_error"`
	CalculatedCorrection float64   `gorm:"column:calculated_correction" json:"calculated_correction"`
	ExpandedUncertaintyU float64   `gorm:"column:expanded_uncertainty_u" json:"expanded_uncertainty_u"`
	EMTLimit             float64   `gorm:"column:emt_limit" json:"emt_limit"`
	GuardBandSum         float64   `gorm:"column:guard_band_sum" json:"guard_band_sum"`
	// False when the certificate printed no EMT for the point, so IsConforme
	// carries no verdict and must not be rendered as a pass.
	// No `default:` tag here on purpose. GORM treats a zero value as "use
	// the column default", so `default:true` silently rewrote every false
	// into true - which is precisely the unearned pass this flag prevents.
	ConformityDecided    bool      `gorm:"column:conformity_decided" json:"conformity_decided"`
	IsConforme           bool      `gorm:"column:is_conforme" json:"is_conforme"`
	IsReturnPoint        bool      `gorm:"column:is_return_point" json:"is_return_point"`
	IsHysteresisValid    bool      `gorm:"column:is_hysteresis_valid" json:"is_hysteresis_valid"`
	CreatedAt            time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (MeasurementPoint) TableName() string {
	return "measurement_points"
}

// AnomalyAuditLog records one blocking anomaly or warning raised by the audit.
type AnomalyAuditLog struct {
	ID                string    `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CertificateID     string    `gorm:"column:certificate_id;index" json:"certificate_id"`
	AnomalyType       string    `gorm:"column:anomaly_type" json:"anomaly_type"`
	Severity          string    `gorm:"column:severity" json:"severity"`
	Description       string    `gorm:"column:description" json:"description"`
	AIConfidenceScore float64   `gorm:"column:ai_confidence_score" json:"ai_confidence_score"`
	DetectedAt        time.Time `gorm:"column:detected_at;autoCreateTime" json:"detected_at"`
}

func (AnomalyAuditLog) TableName() string {
	return "anomaly_audit_logs"
}
