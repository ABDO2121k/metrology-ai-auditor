-- =========================================================
-- PROCESS INSTRUMENTS METROLOGY PLATFORM - DATABASE INIT
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Custom Enum Types
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('ADMINISTRATOR', 'TECHNICIAN', 'VALIDATOR', 'DIRECTOR');

DROP TYPE IF EXISTS certificate_status CASCADE;
CREATE TYPE certificate_status AS ENUM (
    'PENDING_OCR', 
    'PROCESSING', 
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
    nominal_value NUMERIC(12, 4) NOT NULL,
    reference_value NUMERIC(12, 4) NOT NULL,
    measured_value NUMERIC(12, 4) NOT NULL,
    calculated_error NUMERIC(12, 4) NOT NULL,
    calculated_correction NUMERIC(12, 4) NOT NULL,
    expanded_uncertainty_u NUMERIC(12, 4) NOT NULL,
    emt_limit NUMERIC(12, 4) NOT NULL,
    guard_band_sum NUMERIC(12, 4) NOT NULL,
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

-- Seed Users (Bcrypt Password Hashes)
INSERT INTO users (id, username, email, password_hash, full_name, role) VALUES
('ad9accdb-6890-41cd-8cb9-fe7bff7f4e67', 'fati_sadiki', 'fati_sadiki@process-instruments.ma', '$2a$10$rC8d3.5F4mK0tqN3x0H5u.j5p3170425042504250425042504250', 'Fatima-Ezzahrae Sadiki', 'ADMINISTRATOR'),
('b21c4e90-1234-41cd-8cb9-fe7bff7f4e68', 'tech_fati', 'tech_fati@process-instruments.ma', '$2a$10$rC8d3.5F4mK0tqN3x0H5u.j5p3170425042504250425042504250', 'Technicien Étalonneur', 'TECHNICIAN'),
('c32d5f01-5678-41cd-8cb9-fe7bff7f4e69', 'val_fati', 'val_fati@process-instruments.ma', '$2a$10$rC8d3.5F4mK0tqN3x0H5u.j5p3170425042504250425042504250', 'Responsable Validation Qualité', 'VALIDATOR'),
('d43e6a12-9012-41cd-8cb9-fe7bff7f4e70', 'director_fati', 'director_fati@process-instruments.ma', '$2a$10$rC8d3.5F4mK0tqN3x0H5u.j5p3170425042504250425042504250', 'Directeur du Laboratoire', 'DIRECTOR')
ON CONFLICT (username) DO NOTHING;

-- Seed Sample Reference Standards
INSERT INTO reference_standards (code_identifier, designation, validity_expiry_date) VALUES
('REF-ELEC-01', 'Multi-Function Calibrator Fluke 5522A', '2028-12-31'),
('REF-ELEC-02', 'High Precision Resistor Box AOIP', '2027-10-15'),
('REF-ELEC-03', 'Pt100 Reference Temperature Probe', '2028-06-30')
ON CONFLICT (code_identifier) DO NOTHING;

-- Seed Sample Certificates Across 5 Models
INSERT INTO certificates (id, certificate_number, original_filename, file_path_s3, file_hash_sha256, status, page_count, announced_page_count, client_name, instrument_name, instrument_serial, issue_date, calibration_date, next_calibration_date, ambient_temperature, ambient_humidity, uploaded_by, validated_by) VALUES
('e1000000-0000-0000-0000-000000000001', 'ARRM13388-26', 'ARRM13388-26.pdf', 'metrology-certificates/ARRM13388-26.pdf', 'hash_sha256_cert1_arrm13388', 'VALIDATED_CONFORME', 2, 2, 'OCP Group', 'Resistor Box AOIP', 'SN-99812', '2026-07-29', '2026-07-29', '2027-07-29', '23.0 °C', '50.0 % HR', 'b21c4e90-1234-41cd-8cb9-fe7bff7f4e68', 'c32d5f01-5678-41cd-8cb9-fe7bff7f4e69'),
('e2000000-0000-0000-0000-000000000002', 'AETE04897-26', 'AETE04897-26.pdf', 'metrology-certificates/AETE04897-26.pdf', 'hash_sha256_cert2_aete04897', 'VALIDATED_CONFORME', 4, 4, 'ONEE Power', 'Pt100 Temperature Sensor', 'SN-44310', '2026-07-29', '2026-07-29', '2027-07-29', '23.0 °C', '50.0 % HR', 'b21c4e90-1234-41cd-8cb9-fe7bff7f4e68', 'c32d5f01-5678-41cd-8cb9-fe7bff7f4e69'),
('e3000000-0000-0000-0000-000000000003', 'ARTL05391-26/A', 'ARTL05391-26_A.pdf', 'metrology-certificates/ARTL05391-26_A.pdf', 'hash_sha256_cert3_artl05391', 'FLAGGED_ANOMALY', 3, 3, 'LafargeHolcim', 'Digital Multimeter Keysight', 'SN-77821', '2026-07-29', '2026-07-29', '2027-07-29', '23.0 °C', '50.0 % HR', 'b21c4e90-1234-41cd-8cb9-fe7bff7f4e68', NULL),
('e4000000-0000-0000-0000-000000000004', 'ARBI13361-26', 'ARBI13361-26.pdf', 'metrology-certificates/ARBI13361-26.pdf', 'hash_sha256_cert4_arbi13361', 'VALIDATED_CONFORME', 2, 2, 'Renault Tangier', 'High Precision Electrical Shunt', 'SN-11204', '2026-07-29', '2026-07-29', '2027-07-29', '23.0 °C', '50.0 % HR', 'b21c4e90-1234-41cd-8cb9-fe7bff7f4e68', 'c32d5f01-5678-41cd-8cb9-fe7bff7f4e69'),
('e5000000-0000-0000-0000-000000000005', 'AENS12791-26', 'AENS12791-26.pdf', 'metrology-certificates/AENS12791-26.pdf', 'hash_sha256_cert5_aens12791', 'VALIDATED_CONFORME', 6, 6, 'Cosumar SA', 'Multi-function Process Calibrator', 'SN-55619', '2026-07-29', '2026-07-29', '2027-07-29', '23.0 °C', '50.0 % HR', 'b21c4e90-1234-41cd-8cb9-fe7bff7f4e68', 'c32d5f01-5678-41cd-8cb9-fe7bff7f4e69')
ON CONFLICT (certificate_number) DO NOTHING;

-- Seed Anomaly Audit Logs for AI Detection
INSERT INTO anomaly_audit_logs (certificate_id, anomaly_type, severity, description, ai_confidence_score) VALUES
('e3000000-0000-0000-0000-000000000003', 'MISSING_SIGNATURE', 'CRITICAL_BLOCKING', 'Validation signature missing on page 3 of multimeter certificate', 98.50),
('e3000000-0000-0000-0000-000000000003', 'MISSING_STAMP', 'CRITICAL_BLOCKING', 'Accreditation seal classification score below threshold', 96.20),
('e3000000-0000-0000-0000-000000000003', 'EMT_LIMIT_EXCEEDED', 'WARNING', 'Guard-band sum |Corr| + U exceeds EMT on measurement point #4', 92.10)
ON CONFLICT DO NOTHING;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_certs_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certs_hash ON certificates(file_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_meas_cert ON measurement_points(certificate_id);
