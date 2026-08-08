# Step 10: Production Deployment via Docker Compose & MinIO Storage (`docker-compose`)

## 1. Objective & Scope

Establish a simple, robust, production-ready deployment model using **Docker Compose** (`docker compose up -d`).

This step eliminates complex orchestration platforms (like Kubernetes/Helm) in favor of a single-command containerized deployment while using **MinIO S3 Object Storage** as the central storage solution for PDF certificates, extracted JSON datasets, and generated PDF audit reports.

---

## 2. Infrastructure Topology with Docker Compose

```
                             ┌─────────────────────────────────────────┐
                             │       Nginx Reverse Proxy Container     │
                             │       (Port 80/443 SSL Termination)     │
                             └────────────────────┬────────────────────┘
                                                  │
                                                  ▼
                             ┌─────────────────────────────────────────┐
                             │  API Gateway & Auth (Go/Fiber) Container│
                             └────────────────────┬────────────────────┘
                                                  │
         ┌────────────────────────────────────────┼────────────────────────────────────────┐
         │                                        │                                        │
         ▼                                        ▼                                        ▼
┌─────────────────────────┐              ┌─────────────────────────┐              ┌─────────────────────────┐
│ document-ingestion (Go) │              │ ocr-parsing (FastAPI)   │              │ metrology-engine        │
└────────┬────────────────┘              └────────┬────────────────┘              └────────┬────────────────┘
         │                                        │                                        │
         │ Stream PDF                             │ JSON                                   │ Results
         ▼                                        ▼                                        ▼
┌─────────────────────────┐              ┌─────────────────────────┐              ┌─────────────────────────┐
│ MinIO Object Storage    │              │ PostgreSQL 16 DB        │              │ Redis 7 Cache & Queue   │
│ (metrology-certificates)│              │ (Relational Data)       │              │ (Pub/Sub Event Bus)     │
└─────────────────────────┘              └─────────────────────────┘              └─────────────────────────┘
```

---

## 3. Complete Production `docker-compose.yml`

Create/Update `app/docker-compose.yml`:

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
  # ==========================================
  # 1. DATABASE & CACHE & STORAGE INFRASTRUCTURE
  # ==========================================

  # PostgreSQL 16 Relational Database
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

  # Redis 7 Cache & Message Bus
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

  # MinIO Object Storage (Primary Storage for PDFs & Reports)
  minio:
    image: minio/minio:latest
    container_name: metrology_minio
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio_admin
      MINIO_ROOT_PASSWORD: MinioSecretPassword123!
    ports:
      - "9000:9000"   # S3 API Port
      - "9001:9001"   # Web Console Port
    volumes:
      - minio_data:/data
    networks:
      - metrology-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 5

  # MinIO Bucket Auto-Initializer
  createbuckets:
    image: minio/mc:latest
    container_name: metrology_minio_init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      /usr/bin/mc alias set myminio http://minio:9000 minio_admin MinioSecretPassword123!;
      /usr/bin/mc mb myminio/metrology-certificates --ignore-existing;
      /usr/bin/mc mb myminio/audit-reports --ignore-existing;
      /usr/bin/mc anonymous set download myminio/metrology-certificates;
      exit 0;
      "
    networks:
      - metrology-net

  # ==========================================
  # 2. APPLICATION MICROSERVICES
  # ==========================================

  # Auth Gateway (Go)
  auth-gateway:
    build:
      context: ./services/auth-gateway
      dockerfile: Dockerfile
    container_name: service_auth_gateway
    restart: always
    environment:
      PORT: 8000
      JWT_SECRET: SuperSecretJwtKey2026!
      POSTGRES_DSN: "postgres://metrology_admin:SecretPassword123!@postgres:5432/metrology_db?sslmode=disable"
      REDIS_URL: "redis://:RedisSecret123!@redis:6379/0"
      DOCUMENT_SERVICE_URL: "http://document-ingestion:8001"
      OCR_SERVICE_URL: "http://ocr-parsing:8002"
      METROLOGY_SERVICE_URL: "http://metrology-engine:8003"
      AI_SERVICE_URL: "http://ai-anomaly:8004"
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - metrology-net

  # Document Ingestion Service (Go + MinIO S3 API)
  document-ingestion:
    build:
      context: ./services/document-ingestion
      dockerfile: Dockerfile
    container_name: service_document_ingestion
    restart: always
    environment:
      PORT: 8001
      MINIO_ENDPOINT: "minio:9000"
      MINIO_ACCESS_KEY: "minio_admin"
      MINIO_SECRET_KEY: "MinioSecretPassword123!"
      MINIO_BUCKET: "metrology-certificates"
      POSTGRES_DSN: "postgres://metrology_admin:SecretPassword123!@postgres:5432/metrology_db?sslmode=disable"
      REDIS_URL: "redis://:RedisSecret123!@redis:6379/0"
    depends_on:
      minio:
        condition: service_healthy
    networks:
      - metrology-net

  # OCR Parsing Service (Python FastAPI + PaddleOCR)
  ocr-parsing:
    build:
      context: ./services/ocr-parsing
      dockerfile: Dockerfile
    container_name: service_ocr_parsing
    restart: always
    environment:
      PORT: 8002
      REDIS_URL: "redis://:RedisSecret123!@redis:6379/0"
      MINIO_ENDPOINT: "minio:9000"
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - metrology-net

  # Metrology Rule Engine (Python)
  metrology-engine:
    build:
      context: ./services/metrology-engine
      dockerfile: Dockerfile
    container_name: service_metrology_engine
    restart: always
    environment:
      PORT: 8003
    networks:
      - metrology-net

  # AI Anomaly Detection Service (Python FastAPI + ONNX)
  ai-anomaly:
    build:
      context: ./services/ai-anomaly
      dockerfile: Dockerfile
    container_name: service_ai_anomaly
    restart: always
    environment:
      PORT: 8004
    networks:
      - metrology-net

  # Reporting & Notification Service (Node.js)
  reporting-notification:
    build:
      context: ./services/reporting-notification
      dockerfile: Dockerfile
    container_name: service_reporting_notification
    restart: always
    environment:
      PORT: 8005
      REDIS_URL: "redis://:RedisSecret123!@redis:6379/0"
      MINIO_ENDPOINT: "minio:9000"
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - metrology-net

  # Next.js 14 Web Frontend
  web-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: app_web_frontend
    restart: always
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_GATEWAY_URL: "http://localhost:8000"
      NEXT_PUBLIC_WS_URL: "ws://localhost:8005/ws/notifications"
    depends_on:
      - auth-gateway
    networks:
      - metrology-net
```

---

## 4. Single-Command Launch & Management

To launch the entire platform in production mode:

```bash
# 1. Navigate to app folder
cd app/

# 2. Build and start all 10 containers in detached background mode
docker compose up -d --build

# 3. View real-time logs across all services
docker compose logs -f

# 4. Check status and health of all containers
docker compose ps
```

---

## 5. MinIO Storage Verification & Inspection

1. Access MinIO Web Console at `http://localhost:9001`.
2. Login with credentials:
   - **Username**: `minio_admin`
   - **Password**: `MinioSecretPassword123!`
3. Verify that `metrology-certificates` and `audit-reports` buckets exist.
4. Test upload a certificate through the Next.js UI at `http://localhost:3000/upload`. Confirm the file appears instantly inside the `metrology-certificates` bucket.

---

## 6. Execution Checklist

- [ ] Run `docker compose up -d --build` from `app/`.
- [ ] Confirm all containers show `Up (healthy)` state in `docker compose ps`.
- [ ] Log into MinIO console at `http://localhost:9001` and verify object storage buckets are created automatically.
- [ ] Test end-to-end PDF processing flow from `http://localhost:3000`.
