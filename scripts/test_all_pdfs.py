import os
import sys

# Add ocr-parsing service directory to import path
sys.path.append(os.path.abspath("services/ocr-parsing"))

from ocr_engine import extract_pdf_data

pdf_files = [
    "Certif 1.pdf",
    "Certif 2.pdf",
    "Certif 3.pdf",
    "Certif 4.pdf",
    "Certif 5.pdf"
]

base_dir = os.path.abspath("..")

print("==========================================================")
print("TESTING OCR EXTRACTION PARSER ON ALL 5 CERTIFICATE TYPES")
print("==========================================================")

for pdf_name in pdf_files:
    pdf_path = os.path.join(base_dir, pdf_name)
    print(f"\n--- FILE: {pdf_name} ---")
    if not os.path.exists(pdf_path):
        print(f"ERROR: File not found at {pdf_path}")
        continue
    
    try:
        data = extract_pdf_data(pdf_path, f"TEST-{pdf_name[:7]}")
        print(f"✓ Certificate Number : {data.certificate_number}")
        print(f"✓ Client Name        : {data.client_name}")
        print(f"✓ Instrument         : {data.instrument_name}")
        print(f"✓ Serial Number      : {data.instrument_serial}")
        print(f"✓ Page Count         : Announced {data.announced_page_count} / Actual Extracted {data.actual_extracted_pages}")
        print(f"✓ Issue Date         : {data.issue_date}")
        print(f"✓ Calibration Date   : {data.calibration_date}")
        print(f"✓ Next Calibration   : {data.next_calibration_date}")
        print(f"✓ Ambient Temp       : {data.ambient_temperature}")
        print(f"✓ Ambient Humidity   : {data.ambient_humidity}")
        print(f"✓ Standard Code      : {data.reference_standard_code}")
        print(f"✓ Standard Expiry    : {data.reference_standard_expiry}")
        print(f"✓ Has Stamp/Logo     : {data.has_stamp_logo}")
        print(f"✓ Has Signature      : {data.has_signature}")
        print(f"✓ Measurement Points : {len(data.measurements)} points extracted")
    except Exception as e:
        print(f"❌ Extraction Error on {pdf_name}: {e}")
