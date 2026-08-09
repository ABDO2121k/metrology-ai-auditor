package models

import (
	"time"
)

type Certificate struct {
	ID                  string    `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CertificateNumber   string    `gorm:"column:certificate_number;uniqueIndex" json:"certificate_number"`
	OriginalFilename    string    `gorm:"column:original_filename;not null" json:"original_filename"`
	FilePathS3          string    `gorm:"column:file_path_s3;not null" json:"file_path_s3"`
	FileHashSHA256      string    `gorm:"column:file_hash_sha256;uniqueIndex;not null" json:"file_hash_sha256"`
	Status              string    `gorm:"type:certificate_status;default:'PENDING_OCR'" json:"status"`
	PageCount           int       `gorm:"column:page_count;default:0" json:"page_count"`
	AnnouncedPageCount  int       `gorm:"column:announced_page_count;default:0" json:"announced_page_count"`
	ClientName          string    `gorm:"column:client_name" json:"client_name"`
	InstrumentName      string    `gorm:"column:instrument_name" json:"instrument_name"`
	InstrumentSerial    string    `gorm:"column:instrument_serial" json:"instrument_serial"`
	IssueDate           *time.Time `gorm:"column:issue_date" json:"issue_date"`
	CalibrationDate     *time.Time `gorm:"column:calibration_date" json:"calibration_date"`
	NextCalibrationDate *time.Time `gorm:"column:next_calibration_date" json:"next_calibration_date"`
	AmbientTemperature  string    `gorm:"column:ambient_temperature" json:"ambient_temperature"`
	AmbientHumidity     string    `gorm:"column:ambient_humidity" json:"ambient_humidity"`
	UploadedBy          *string   `gorm:"column:uploaded_by" json:"uploaded_by"`
	ValidatedBy         *string   `gorm:"column:validated_by" json:"validated_by"`
	CreatedAt           time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (Certificate) TableName() string {
	return "certificates"
}
