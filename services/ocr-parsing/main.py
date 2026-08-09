import os
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
from schemas import OCRParseRequest, ExtractedCertificateData
from ocr_engine import extract_pdf_data

app = FastAPI(
    title="Process Instruments OCR & Parsing Microservice",
    version="1.0.0"
)

# Allow CORS so browser clients (through gateway or direct) can call OCR endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ocr-parsing"}

def download_from_minio(s3_path: str) -> str:
    normalized = s3_path.strip().lstrip("/")
    if not normalized:
        raise ValueError("Empty s3_path")

    base_url = os.getenv("MINIO_PUBLIC_BASE_URL", "http://minio:9000").rstrip("/")
    url = f"{base_url}/{normalized}"

    response = requests.get(url, timeout=20)
    if response.status_code != 200:
        raise FileNotFoundError(f"Unable to fetch PDF from object storage: {url}")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    try:
        tmp.write(response.content)
        tmp.flush()
        return tmp.name
    finally:
        tmp.close()

@app.post("/api/v1/ocr/parse", response_model=ExtractedCertificateData)
def parse_certificate(req: OCRParseRequest):
    pdf_path = req.file_bytes_path or ""
    tmp_path_to_cleanup = None
    try:
        if not pdf_path:
            if not req.s3_path:
                raise HTTPException(status_code=400, detail="Either file_bytes_path or s3_path is required")
            tmp_path_to_cleanup = download_from_minio(req.s3_path)
            pdf_path = tmp_path_to_cleanup

        data = extract_pdf_data(pdf_path, req.certificate_id)
        return data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR parsing failed: {str(e)}")
    finally:
        if tmp_path_to_cleanup:
            try:
                os.remove(tmp_path_to_cleanup)
            except OSError:
                pass

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT_OCR", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
