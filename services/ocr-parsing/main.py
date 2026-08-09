import os
from fastapi import FastAPI, HTTPException
from schemas import OCRParseRequest, ExtractedCertificateData
from ocr_engine import extract_pdf_data

app = FastAPI(
    title="Process Instruments OCR & Parsing Microservice",
    version="1.0.0"
)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ocr-parsing"}

@app.post("/api/v1/ocr/parse", response_model=ExtractedCertificateData)
def parse_certificate(req: OCRParseRequest):
    try:
        data = extract_pdf_data(req.file_bytes_path, req.certificate_id)
        return data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR parsing failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT_OCR", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
