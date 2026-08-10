# Deployment Guide: AI-Enhanced OCR Service with Status Management

## Overview
This guide covers the deployment of the updated OCR service with integrated OpenAI validation, improved status management, and enhanced frontend navigation.

## Key Changes

### 1. OCR Service Enhancements

#### New Features:
- **AI Validation**: Uses OpenAI GPT-4 to validate extracted data
- **Quality Metrics**: Returns confidence scores (0-1 scale)
  - `confidence_score`: OCR extraction accuracy
  - `data_quality_score`: Completeness and format correctness
  - `measurement_validity_score`: Anomaly detection in measurements
- **Compliance Checking**: Validates against metrological standards
- **Detailed Reports**: Critical issues, warnings, and improvement suggestions

#### Status Flow Changes:
```
PDF Upload
    ↓
Initial: "OCR_PROCESSING"
    ↓
OCR Engine Extracts Data
    ↓
AI Validation (GPT-4)
    ↓
Final: "OCR_COMPLETED"
    ↓
Ready for Evaluation
```

**Important**: OCR runs only **once per PDF upload**, not repeatedly.

### 2. Environment Configuration

#### Required Environment Variables:

```bash
# OCR Service (Python/FastAPI)
OPENAI_API_KEY=sk-xxxxxxxxxxxx  # Your OpenAI API key
OCR_SERVICE_URL=http://ocr-parsing:8002
MINIO_PUBLIC_BASE_URL=http://minio:9000
PORT_OCR=8002

# Document Ingestion Service (Go/Fiber)
OCR_SERVICE_URL=http://ocr-parsing:8002
DATABASE_URL=postgresql://metrology_admin:SecretPassword123!@postgres:5432/metrology_db
```

### 3. Dependencies

#### OCR Service Requirements (Python):
```
fastapi==0.110.0
uvicorn==0.28.0
pydantic==2.6.4
PyMuPDF==1.24.1
rapidocr_onnxruntime==1.2.3
requests==2.31.0
openai==1.3.0          # NEW: AI validation
redis==5.0.3
python-multipart==0.0.9
```

### 4. Frontend Enhancements

#### Dashboard Navigation:
- **Authenticated users** now see a dashboard link (🏠 icon) in the navbar
- Link appears next to password reset and logout buttons
- Accessible via sidebar on desktop (always visible when logged in)
- Accessible via navbar dashboard button on all screen sizes

#### Authentication Guard:
- Dashboard (`/dashboard`) requires authentication
- All authenticated users can access dashboard
- Role-based navigation automatically shows appropriate sections
  - **TECHNICIAN**: Upload, Certificates
  - **VALIDATOR**: Certificates, Eval-5Certs, Reports
  - **DIRECTOR**: Director Dashboard, Reports
  - **ADMINISTRATOR**: Users Management, Docker Metrics

## Deployment Steps

### Step 1: Update Environment Variables

Create/update `.env` file or Docker secrets:

```bash
# For local development
export OPENAI_API_KEY="your-openai-api-key"

# For Docker
docker-compose -f docker-compose.yml up --build
```

### Step 2: Rebuild Services

```bash
# Rebuild OCR service with OpenAI support
cd services/ocr-parsing
docker build -t metrology-ocr:latest .

# Rebuild document-ingestion to use updated status flow
cd ../document-ingestion
docker build -t metrology-ingestion:latest .

# Rebuild frontend (automatic with Next.js)
cd ../../frontend
docker build -t metrology-frontend:latest .
```

### Step 3: Deploy

```bash
# Update docker-compose to use new images
docker-compose up -d

# Verify services are healthy
docker-compose ps

# Check OCR service logs
docker-compose logs ocr-parsing

# Check document-ingestion logs
docker-compose logs document-ingestion
```

### Step 4: Verify Deployment

1. **Test Login**:
   - Navigate to `http://localhost:3000/login`
   - Use demo credentials:
     - Admin: `fati_sadiki` / `fati2004@`
     - Technician: `tech_fati` / `fati2004@`
     - Validator: `val_fati` / `fati2004@`
     - Director: `director_fati` / `fati2004@`

2. **Test Dashboard Access**:
   - After login, you should see dashboard link in navbar (🏠 icon)
   - Click to navigate to dashboard
   - Sidebar shows role-appropriate sections

3. **Test PDF Upload**:
   - Click "Upload" in sidebar (TECHNICIAN view)
   - Upload a calibration certificate PDF
   - Monitor status progression:
     - Status shows "OCR_PROCESSING" during extraction
     - After ~10-30 seconds, updates to "OCR_COMPLETED"
     - AI validation scores appear in certificate details

4. **Verify AI Validation**:
   - In certificate details, look for `ai_validation` section
   - Check: confidence_score, data_quality_score, measurement_validity_score
   - Review any critical_issues or warnings

## Response Format

### OCR Response with AI Validation:

```json
{
  "certificate_id": "abc-123-def",
  "certificate_number": "ARRM13388-26",
  "client_name": "CLIENT SARL",
  "instrument_name": "Multimètre Numérique",
  "instrument_serial": "12345",
  "announced_page_count": 5,
  "actual_extracted_pages": 5,
  "issue_date": "2026-07-29",
  "calibration_date": "2026-07-15",
  "next_calibration_date": "2027-07-28",
  "ambient_temperature": "23 ± 2 °C",
  "ambient_humidity": "≤ 80 %HR",
  "measurements": [...],
  "ai_validation": {
    "confidence_score": 0.92,
    "data_quality_score": 0.88,
    "measurement_validity_score": 0.85,
    "critical_issues": [],
    "warnings": ["Some measurements exceed EMT limits"],
    "suggestions": ["Verify ambient humidity values"],
    "validation_passed": true,
    "validation_timestamp": "2026-08-10T14:23:45.123456"
  }
}
```

## Troubleshooting

### Issue: OpenAI API Key Not Set
**Error**: `OCR validation failed: No API key provided`
**Solution**: 
```bash
export OPENAI_API_KEY="your-key-here"
docker-compose restart ocr-parsing
```

### Issue: OCR Service Timeout
**Error**: `OCR service returned 504: Gateway Timeout`
**Solution**:
- Increase timeout in `upload_handler.go`: currently `45 * time.Second`
- Check OCR service logs: `docker-compose logs ocr-parsing`
- Ensure PDFs are valid and <50MB

### Issue: Dashboard Link Not Appearing
**Error**: No dashboard icon in navbar when authenticated
**Solution**:
- Clear browser cache: `localStorage.clear()`
- Verify JWT token is stored: Check DevTools > Application > Local Storage
- Verify `jwt_user` object has `role` property

### Issue: Authentication Failing
**Error**: "Username or password incorrect" after UI changes
**Solution**:
- Verify user exists in database: `psql metrology_db -c "SELECT * FROM users;"`
- Check auth-gateway logs: `docker-compose logs auth-gateway`
- Ensure auth gateway is running: `docker-compose ps auth-gateway`

## Performance Considerations

### OCR Processing Time:
- Simple PDFs (text-based): 2-5 seconds
- Scanned PDFs (image-based): 5-15 seconds
- Large PDFs (>50 pages): 15-30 seconds
- AI validation (GPT-4): 2-5 seconds additional

### Optimization Tips:
1. Use `rapidocr_onnxruntime` for faster OCR (already included)
2. Cache OpenAI responses for duplicate PDFs
3. Process PDFs asynchronously if timeout issues occur
4. Consider GPT-3.5-turbo for faster (less accurate) validation

## Rollback Procedure

If issues occur, revert to previous version:

```bash
# Revert docker-compose to use old images
git checkout HEAD~1 docker-compose.yml

# Stop current services
docker-compose down

# Deploy previous version
docker-compose up -d

# Verify old version works
docker-compose logs
```

## Monitoring

### Health Checks:

```bash
# OCR Service Health
curl http://localhost:8002/health

# Document Ingestion Health
curl http://localhost:8001/health

# Frontend Health
curl http://localhost:3000

# Database Connection
docker-compose exec postgres psql -U metrology_admin -d metrology_db -c "SELECT 1"
```

### Logs to Monitor:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ocr-parsing
docker-compose logs -f document-ingestion
docker-compose logs -f frontend

# Filter by level
docker-compose logs -f --tail=50 ocr-parsing | grep ERROR
```

## Support & Documentation

- **OpenAI API Docs**: https://platform.openai.com/docs
- **FastAPI Docs**: http://localhost:8002/docs (Swagger UI)
- **Frontend Build**: See `frontend/README.md`
- **Database Schema**: See `scripts/init-db.sql`

---

**Deployment Date**: 2026-08-10
**Version**: 2.0 (AI-Enhanced OCR)
**Status**: ✓ Ready for Production
