# Step 1: Infrastructure, Repository Architecture & Microservices Setup

## 1. Objective & Scope

Establish a highly resilient, containerized, high-throughput microservices infrastructure foundation for the **Process Instruments Intelligent Validation Platform**.

This step sets up:
- Monorepo folder layout for all microservices.
- **Docker Compose** orchestration for local and staging environments.
- **PostgreSQL 16** container with production-ready schemas, indexes, and partitions.
- **Redis 7** container for caching, pub-sub messaging, and distributed job queues.
- **MinIO Object Storage** container configured for S3 API compatibility.
- Environment configuration templates (`.env.example`) and network isolation policies.

---

## 2. Recommended Microservices Directory Structure

```
fati_project/
├── app/
│   ├── plan/
│   │   ├── overview.md
│   │   ├── step1_architecture_and_infrastructure_setup.md
│   │   ├── step2_gateway_auth_microservice.md
│   │   ├── step3_document_storage_ingestion_microservice.md
│   │   ├── step4_ocr_parsing_microservice.md
│   │   ├── step5_metrological_rule_engine_microservice.md
│   │   ├── step6_ai_anomaly_detection_microservice.md
│   │   ├── step7_reporting_notification_microservice.md
│   │   ├── step8_frontend_microservices_dashboard.md
│   │   ├── step9_microservices_integration_testing_cicd.md
│   │   └── step10_deployment_monitoring_production_readiness.md
│   │
│   ├── services/
│   │   ├── auth-gateway/               # Go (Fiber) Gateway & Auth Service
│   │   ├── document-ingestion/          # Go Document & MinIO Ingestion Service
│   │   ├── ocr-parsing/                # Python (FastAPI + PaddleOCR) Service
│   │   ├── metrology-engine/           # Python ISO 17025 Calculation Engine
│   │   ├── ai-anomaly/                 # Python (PyTorch/LightGBM) AI Engine
│   │   └── reporting-notification/     # Node.js/Go PDF & Notification Service
│   │
│   ├── frontend/                       # Next.js 14 Web Application
│   ├── docker-compose.yml              # Multi-container local deployment
│   ├── docker-compose.override.yml     # Local dev sync overrides
│   └── scripts/
│       ├── init-db.sql                 # PostgreSQL tables & migrations
│       └── init-minio.sh               # MinIO bucket policy initializer
```

---

## 3. Technology Choices & Infrastructure Rationale

| Infrastructure Component | Tech Chosen | Rationale vs Traditional Setup |
| :--- | :--- | :--- |
| **Container Engine** | Docker Compose / Docker Engine 25+ | Uniform execution across Windows, Linux, and Cloud instances without dependency conflicts. |
| **Primary Database** | PostgreSQL 16 | ACID compliant, strong JSONB support for OCR data, automatic UUID generation, row-level security. |
| **Object Store** | MinIO Enterprise S3 Compatible | High-speed binary object storage (PDF files) with built-in encryption and bucket lifecycle rules. |
| **Cache & Event Bus** | Redis 7 Alpine | Sub-millisecond latency for session validation, cache headers, and pub-sub asynchronous message delivery. |

---

## 4. Implementation Details

### 4.1 Master `docker-compose.yml` Configuration

Create `app/docker-compose.yml`:

```yaml
version: '3.8'

networks:
  metrology-net:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  minio_data:

services:
  # 1. PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: metrology_postgres
    restart: always
    environment:
      POSTGRES_DB: metrology_db
      POSTGRES_USER: metrology_admin
      POSTGRES_PASSWORD: SecretPassword123!
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    networks:
      - metrology-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U metrology_admin -d metrology_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # 2. Redis Cache & Event Bus
  redis:
    image: redis:7-alpine
    container_name: metrology_redis
    restart: always
    command: redis-server --save 60 1 --loglevel warning --requirepass RedisSecret123!
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - metrology-net
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "RedisSecret123!", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # 3. MinIO S3 Object Storage
  minio:
    image: minio/minio:latest
    container_name: metrology_minio
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio_admin
      MINIO_ROOT_PASSWORD: MinioSecretPassword123!
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    networks:
      - metrology-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 5
```

---

### 4.2 Database Relational Schema (`scripts/init-db.sql`)

Create `app/scripts/init-db.sql` with high-performance indexes:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types for System Roles & Certificate States
CREATE TYPE user_role AS ENUM ('ADMINISTRATOR', 'TECHNICIAN', 'VALIDATOR');
CREATE TYPE certificate_status AS ENUM ('PENDING_OCR', 'PROCESSING', 'VALIDATED_CONFORME', 'REJECTED_NON_CONFORME', 'FLAGGED_ANOMALY');

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'TECHNICIAN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Certificates Table
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_number VARCHAR(100) UNIQUE NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path_s3 VARCHAR(512) NOT NULL,
    file_hash_sha256 VARCHAR(64) UNIQUE NOT NULL,
    status certificate_status DEFAULT 'PENDING_OCR',
    page_count INT DEFAULT 0,
    uploaded_by UUID REFERENCES users(id),
    issue_date DATE,
    calibration_date DATE,
    next_calibration_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Calibration Equipment & Reference Standards
CREATE TABLE reference_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_identifier VARCHAR(100) UNIQUE NOT NULL,
    designation VARCHAR(255) NOT NULL,
    validity_expiry_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Extracted Measurements & Recalculation Results
CREATE TABLE measurement_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    nominal_value NUMERIC(12, 4) NOT NULL,
    reference_value NUMERIC(12, 4) NOT NULL,
    measured_value NUMERIC(12, 4) NOT NULL,
    calculated_error NUMERIC(12, 4) NOT NULL,
    calculated_correction NUMERIC(12, 4) NOT NULL,
    expanded_uncertainty_u NUMERIC(12, 4) NOT NULL,
    emt_limit NUMERIC(12, 4) NOT NULL,
    is_conforme BOOLEAN NOT NULL,
    is_hysteresis_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. AI Anomaly Audit Log Table
CREATE TABLE anomaly_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    anomaly_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('CRITICAL_BLOCKING', 'WARNING', 'INFO')),
    description TEXT NOT NULL,
    ai_confidence_score NUMERIC(5, 2) NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX idx_certs_status ON certificates(status);
CREATE INDEX idx_certs_hash ON certificates(file_hash_sha256);
CREATE INDEX idx_meas_cert ON measurement_points(certificate_id);
CREATE INDEX idx_anomaly_cert ON anomaly_audit_logs(certificate_id);
```

---

## 5. Verification & Execution Checklist

- [ ] Execute `docker-compose up -d postgres redis minio` from `app/`.
- [ ] Connect to PostgreSQL on port `5432` and verify all 5 tables (`users`, `certificates`, `reference_standards`, `measurement_points`, `anomaly_audit_logs`) were generated cleanly.
- [ ] Ping Redis via `docker exec -it metrology_redis redis-cli -a RedisSecret123! PING` and expect `PONG`.
- [ ] Log into MinIO Console at `http://localhost:9001` using `minio_admin` / `MinioSecretPassword123!`. Create bucket `metrology-certificates`.
