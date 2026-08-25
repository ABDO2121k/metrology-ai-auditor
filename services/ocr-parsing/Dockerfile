FROM python:3.11-slim

WORKDIR /app

# libgl1/libglib2.0-0 are required by the OpenCV bits inside rapidocr.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Bake the OCR models into the image. Without this the first request after a
# deploy pays the model download and pushes the caller past its timeout.
RUN python -c "from rapidocr_onnxruntime import RapidOCR; RapidOCR(); print('OCR models cached')"

ENV PYTHONUNBUFFERED=1

EXPOSE 8002

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD curl -fsS http://localhost:8002/health || exit 1

CMD ["python", "main.py"]
