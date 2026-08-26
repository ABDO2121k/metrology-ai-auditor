-- =========================================================
-- PROCESS INSTRUMENTS METROLOGY PLATFORM - DATABASE INIT
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Custom Enum Types
-- One role only: the technician performs every task on the platform
-- (upload, OCR review, metrological validation, reporting, user admin).
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('TECHNICIAN');

DROP TYPE IF EXISTS certificate_status CASCADE;
CREATE TYPE certificate_status AS ENUM (
    'PENDING_OCR',
    'OCR_PROCESSING',
    'OCR_COMPLETED',
    'OCR_FAILED',
    'VALIDATED_CONFORME',
    'REJECTED_NON_CONFORME',
    'FLAGGED_ANOMALY'
);

-- 2. Users Table
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'TECHNICIAN',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Reference Standards Table (ISO 17025 Compliance)
DROP TABLE IF EXISTS reference_standards CASCADE;
CREATE TABLE IF NOT EXISTS reference_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_identifier VARCHAR(100) UNIQUE NOT NULL,
    designation VARCHAR(255) NOT NULL,
    validity_expiry_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Certificates Table
DROP TABLE IF EXISTS certificates CASCADE;
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_number VARCHAR(100) UNIQUE NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path_s3 VARCHAR(512) NOT NULL,
    file_hash_sha256 VARCHAR(64) UNIQUE NOT NULL,
    status certificate_status DEFAULT 'PENDING_OCR',
    page_count INT DEFAULT 0,
    announced_page_count INT DEFAULT 0,
    client_name VARCHAR(255),
    instrument_name VARCHAR(255),
    instrument_serial VARCHAR(100),
    issue_date DATE,
    calibration_date DATE,
    next_calibration_date DATE,
    ambient_temperature VARCHAR(50),
    ambient_humidity VARCHAR(50),
    -- Full OCR/audit extraction, stored so the certificate detail view can
    -- render results without re-running a 30s OCR pass on every page load.
    ocr_payload JSONB,
    ocr_confidence NUMERIC(5, 4),
    extraction_quality VARCHAR(20),
    conformity_status VARCHAR(30),
    ocr_error TEXT,
    ocr_completed_at TIMESTAMP WITH TIME ZONE,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Extracted Measurement Points Table
DROP TABLE IF EXISTS measurement_points CASCADE;
CREATE TABLE IF NOT EXISTS measurement_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    point_index INT NOT NULL,
    -- A measurement without its unit cannot be interpreted, let alone audited.
    unit VARCHAR(20),
    parameter VARCHAR(120),
    nominal_value NUMERIC(12, 4) NOT NULL,
    reference_value NUMERIC(12, 4) NOT NULL,
    measured_value NUMERIC(12, 4) NOT NULL,
    calculated_error NUMERIC(12, 4) NOT NULL,
    calculated_correction NUMERIC(12, 4) NOT NULL,
    expanded_uncertainty_u NUMERIC(12, 4) NOT NULL,
    emt_limit NUMERIC(12, 4) NOT NULL,
    guard_band_sum NUMERIC(12, 4) NOT NULL,
    -- FALSE when no EMT was printed: is_conforme then carries no verdict.
    conformity_decided BOOLEAN NOT NULL DEFAULT TRUE,
    is_conforme BOOLEAN NOT NULL,
    is_return_point BOOLEAN DEFAULT FALSE,
    is_hysteresis_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. AI Anomaly Audit Logs Table
DROP TABLE IF EXISTS anomaly_audit_logs CASCADE;
CREATE TABLE IF NOT EXISTS anomaly_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    anomaly_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('CRITICAL_BLOCKING', 'WARNING', 'INFO')),
    description TEXT NOT NULL,
    ai_confidence_score NUMERIC(5, 2) NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- SEED INITIAL DATA (BCRYPT HASHES)
-- =========================================================

-- Seed Users. The password_hash values below are placeholders: the
-- auth-gateway re-hashes DEFAULT_ADMIN_PASSWORD into every seeded account on
-- each start, so these never need to be valid bcrypt output.
INSERT INTO users (id, username, email, password_hash, full_name, role) VALUES
('ad9accdb-6890-41cd-8cb9-fe7bff7f4e67', 'fati_sadiki', 'fati_sadiki@process-instruments.ma', 'seeded-at-startup', 'Fatima-Ezzahrae Sadiki', 'TECHNICIAN')
ON CONFLICT (username) DO NOTHING;

-- =========================================================
-- NO DEMO DATA
-- =========================================================
-- Earlier revisions seeded five certificates, three reference standards and
-- three anomaly rows. They were removed because they were not real:
--
--   * file_hash_sha256 held placeholders like 'hash_sha256_cert1_arrm13388'
--     rather than an actual digest, so the duplicate check could never match
--     them;
--   * file_path_s3 pointed at objects that were never uploaded to MinIO, so
--     the rows could not be opened, downloaded or re-processed;
--   * they carried no ocr_payload and no measurement_points, so the detail
--     view had nothing to show;
--   * they still counted towards every dashboard KPI, reporting five
--     certificates and four validated ones on a platform that had never
--     processed a single document.
--
-- The platform now starts empty and fills from real uploads. The
-- reference_standards table is kept because the schema documents it, but it
-- is not populated: nothing reads it, and traceability is taken from each
-- certificate's own printed block during extraction.

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_certs_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certs_hash ON certificates(file_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_meas_cert ON measurement_points(certificate_id);
CREATE INDEX IF NOT EXISTS idx_certs_created ON certificates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certs_uploader ON certificates(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_certs_ocr_payload ON certificates USING GIN (ocr_payload);
CREATE INDEX IF NOT EXISTS idx_anomaly_cert ON anomaly_audit_logs(certificate_id);
