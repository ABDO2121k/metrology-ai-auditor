-- =========================================================
-- PROCESS INSTRUMENTS METROLOGY PLATFORM - DATABASE INIT
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Custom Enum Types
CREATE TYPE user_role AS ENUM ('ADMINISTRATOR', 'TECHNICIAN', 'VALIDATOR');
CREATE TYPE certificate_status AS ENUM (
    'PENDING_OCR', 
    'PROCESSING', 
    'VALIDATED_CONFORME', 
    'REJECTED_NON_CONFORME', 
    'FLAGGED_ANOMALY'
);

-- 2. Users Table
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
CREATE TABLE IF NOT EXISTS reference_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_identifier VARCHAR(100) UNIQUE NOT NULL,
    designation VARCHAR(255) NOT NULL,
    validity_expiry_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Certificates Table
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
-- INDEXES FOR MAXIMUM QUERY SPEED
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_certs_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certs_hash ON certificates(file_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_meas_cert ON measurement_points(certificate_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_cert ON anomaly_audit_logs(certificate_id);
CREATE INDEX IF NOT EXISTS idx_standards_code ON reference_standards(code_identifier);

-- =========================================================
-- INITIAL SEED DATA FOR TESTING
-- =========================================================

-- Admin User (Password: AdminSecret123!)
INSERT INTO users (id, username, email, password_hash, full_name, role)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin',
    'admin@process-instruments.ma',
    '$2a$10$7EqJtq98hP1qE3T8yvX8u.E5yUqR1Pz5E6a5w6b7c8d9e0f1g2h3i',
    'System Administrator',
    'ADMINISTRATOR'
) ON CONFLICT DO NOTHING;

-- Technician User (Password: TechSecret123!)
INSERT INTO users (id, username, email, password_hash, full_name, role)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'technician1',
    'technician@process-instruments.ma',
    '$2a$10$7EqJtq98hP1qE3T8yvX8u.E5yUqR1Pz5E6a5w6b7c8d9e0f1g2h3i',
    'Fatima-Ezzahrae Sadiki',
    'TECHNICIAN'
) ON CONFLICT DO NOTHING;

-- Validator User (Password: ValSecret123!)
INSERT INTO users (id, username, email, password_hash, full_name, role)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'validator1',
    'validator@process-instruments.ma',
    '$2a$10$7EqJtq98hP1qE3T8yvX8u.E5yUqR1Pz5E6a5w6b7c8d9e0f1g2h3i',
    'Quality Validator Expert',
    'VALIDATOR'
) ON CONFLICT DO NOTHING;

-- Sample Reference Standard (Tachymètre Optique 13167/25)
INSERT INTO reference_standards (code_identifier, designation, validity_expiry_date)
VALUES ('13167/25', 'Tachymètre optique 6 à 99 900 tr/min', '2027-07-28')
ON CONFLICT DO NOTHING;
