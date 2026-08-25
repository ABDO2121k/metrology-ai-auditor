import logging
import os
import tempfile
import threading

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import local_ocr
import vision
from ocr_engine import extract_pdf_data, is_mock_enabled
from schemas import ExtractedCertificateData, OCRParseRequest

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("ocr-parsing")

app = FastAPI(
    title="Process Instruments OCR & Parsing Microservice",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

DOWNLOAD_TIMEOUT = float(os.getenv("OCR_DOWNLOAD_TIMEOUT", "30"))
MAX_PDF_BYTES = int(os.getenv("OCR_MAX_PDF_BYTES", str(60 * 1024 * 1024)))

_warmup_done = threading.Event()


@app.on_event("startup")
def _startup() -> None:
    """Load OCR models off the request path.

    The first RapidOCR call pays several seconds of ONNX model initialisation.
    Doing that inside a request pushes the caller past its HTTP timeout, so the
    upload appears to fail on an otherwise healthy service.
    """
    if is_mock_enabled():
        logger.warning("MOCK_OCR is enabled - returning fixture data, no real extraction")
        _warmup_done.set()
        return

    def _warm() -> None:
        try:
            ready = local_ocr.warmup()
            logger.info("Local OCR warm-up %s", "succeeded" if ready else "failed")
        finally:
            _warmup_done.set()

    threading.Thread(target=_warm, name="ocr-warmup", daemon=True).start()

    if vision.is_configured():
        logger.info("Vision layer enabled (model=%s)", vision.VISION_MODEL)
    else:
        logger.info("Vision layer disabled - set OPENAI_API_KEY to enable refinement")


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ocr-parsing",
        "mock_mode": is_mock_enabled(),
        "local_ocr_ready": local_ocr.get_engine() is not None,
        "local_ocr_error": local_ocr.engine_error(),
        "vision_enabled": vision.is_configured(),
        "vision_model": vision.VISION_MODEL if vision.is_configured() else None,
        "warmup_complete": _warmup_done.is_set(),
    }


def download_from_minio(s3_path: str) -> str:
    """Fetch the PDF from object storage into a temp file.

    `s3_path` may or may not carry the bucket prefix depending on which service
    produced it, so both spellings are attempted.
    """
    normalized = (s3_path or "").strip().lstrip("/")
    if not normalized:
        raise ValueError("Empty s3_path")

    base_url = os.getenv("MINIO_PUBLIC_BASE_URL", "http://minio:9000").rstrip("/")
    bucket = os.getenv("MINIO_BUCKET", "metrology-certificates")

    candidates = [f"{base_url}/{normalized}"]
    if not normalized.startswith(f"{bucket}/"):
        candidates.append(f"{base_url}/{bucket}/{normalized}")

    last_status = None
    for url in candidates:
        try:
            response = requests.get(url, timeout=DOWNLOAD_TIMEOUT, stream=True)
        except requests.RequestException as exc:
            last_status = f"request failed: {exc}"
            continue

        if response.status_code != 200:
            last_status = f"HTTP {response.status_code}"
            response.close()
            continue

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        written = 0
        try:
            for chunk in response.iter_content(chunk_size=1 << 16):
                if not chunk:
                    continue
                written += len(chunk)
                if written > MAX_PDF_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"PDF exceeds the {MAX_PDF_BYTES // (1024 * 1024)} MB limit",
                    )
                tmp.write(chunk)
            tmp.flush()
            return tmp.name
        except HTTPException:
            tmp.close()
            os.unlink(tmp.name)
            raise
        finally:
            if not tmp.closed:
                tmp.close()
            response.close()

    raise FileNotFoundError(
        f"Unable to fetch PDF from object storage ({last_status}). Tried: {', '.join(candidates)}"
    )


@app.post("/api/v1/ocr/parse", response_model=ExtractedCertificateData)
def parse_certificate(req: OCRParseRequest):
    if is_mock_enabled():
        return extract_pdf_data("__MOCK__", req.certificate_id)

    # Block until models are loaded so the first request returns a real result
    # instead of silently degrading to an empty extraction.
    if not _warmup_done.wait(timeout=120):
        logger.warning("Proceeding before OCR warm-up completed")

    pdf_path = req.file_bytes_path or ""
    tmp_path = None
    try:
        if not pdf_path:
            if not req.s3_path:
                raise HTTPException(
                    status_code=400,
                    detail="Either file_bytes_path or s3_path is required",
                )
            tmp_path = download_from_minio(req.s3_path)
            pdf_path = tmp_path

        return extract_pdf_data(pdf_path, req.certificate_id)

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("OCR parsing failed for %s", req.certificate_id)
        raise HTTPException(status_code=500, detail=f"OCR parsing failed: {exc}")
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT_OCR", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
