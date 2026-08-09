import os
from typing import List, Dict, Any
try:
    from metrology_schemas import MetrologyAuditRequest, MetrologyAuditResult, PointInput
except ImportError:
    from schemas import MetrologyAuditRequest, MetrologyAuditResult, PointInput

app = FastAPI(
    title="Process Instruments Metrology Rule Engine",
    version="1.0.0"
)

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "metrology-engine"}

@app.post("/api/v1/metrology/evaluate", response_model=MetrologyAuditResult)
def evaluate_rules(req: MetrologyAuditRequest):
    return evaluate_certificate_rules(req)

@app.get("/api/v1/metrology/evaluate-5certs")
def evaluate_5certs_demo():
    """Evaluates sample payloads representing each of the 5 certificate types."""
    # Certif 1: Resistor (ARRM13388-26)
    c1_req = MetrologyAuditRequest(
        certificate_id="cert-001",
        certificate_number="ARRM13388-26",
        announced_page_count=2,
        actual_extracted_pages=2,
        calibration_date_str="2026-07-15",
        standard_expiry_date_str="2027-07-28",
        issue_date_str="2026-07-29",
        next_calibration_date_str="2027-07-28",
        temp_celsius=22.5,
        humidity_percent=55.0,
        has_stamp_logo=True,
        has_signature=True,
        measurements=[
            PointInput(point_index=1, grandeur="Resistance", unit="Ω", nominal_value=1.0, reference_value=1.000, measured_value=1.0134, uncertainty_u=0.0082, emt=0.05),
            PointInput(point_index=2, grandeur="Resistance", unit="Ω", nominal_value=10.0, reference_value=10.000, measured_value=10.005, uncertainty_u=0.012, emt=0.05)
        ]
    )

    # Certif 2: Temperature (AETE04897-26)
    c2_req = MetrologyAuditRequest(
        certificate_id="cert-002",
        certificate_number="AETE04897-26",
        announced_page_count=4,
        actual_extracted_pages=4,
        calibration_date_str="2026-07-10",
        standard_expiry_date_str="2027-06-30",
        issue_date_str="2026-07-12",
        next_calibration_date_str="2027-07-10",
        temp_celsius=23.0,
        humidity_percent=60.0,
        has_stamp_logo=True,
        has_signature=True,
        measurements=[
            PointInput(point_index=1, grandeur="Temperature Pt100", unit="°C", nominal_value=0.0, reference_value=0.01, measured_value=0.05, uncertainty_u=0.05, emt=0.20),
            PointInput(point_index=2, grandeur="Temperature Pt100", unit="°C", nominal_value=100.0, reference_value=99.98, measured_value=100.02, uncertainty_u=0.08, emt=0.30, is_return_point=True, aller_correction=-0.04)
        ]
    )

    # Certif 3: Multimeter (ARTL05391-26/A)
    c3_req = MetrologyAuditRequest(
        certificate_id="cert-003",
        certificate_number="ARTL05391-26/A",
        announced_page_count=3,
        actual_extracted_pages=3,
        calibration_date_str="2026-07-18",
        standard_expiry_date_str="2027-08-15",
        issue_date_str="2026-07-20",
        next_calibration_date_str="2027-07-18",
        temp_celsius=24.0,
        humidity_percent=52.0,
        has_stamp_logo=True,
        has_signature=True,
        measurements=[
            PointInput(point_index=1, grandeur="DC Voltage", unit="V", nominal_value=10.0, reference_value=10.0001, measured_value=10.0003, uncertainty_u=0.0005, emt=0.002),
            PointInput(point_index=2, grandeur="AC Current", unit="mA", nominal_value=100.0, reference_value=99.98, measured_value=99.95, uncertainty_u=0.08, emt=0.25)
        ]
    )

    # Certif 4: Electrical Shunt (ARBI13361-26)
    c4_req = MetrologyAuditRequest(
        certificate_id="cert-004",
        certificate_number="ARBI13361-26",
        announced_page_count=2,
        actual_extracted_pages=2,
        calibration_date_str="2026-07-05",
        standard_expiry_date_str="2027-05-30",
        issue_date_str="2026-07-06",
        next_calibration_date_str="2027-07-05",
        temp_celsius=21.5,
        humidity_percent=48.0,
        has_stamp_logo=True,
        has_signature=True,
        measurements=[
            PointInput(point_index=1, grandeur="DC Voltage Shunt", unit="mV", nominal_value=60.0, reference_value=60.002, measured_value=60.010, uncertainty_u=0.008, emt=0.05)
        ]
    )

    # Certif 5: Multi-function Calibrator (AENS12791-26)
    c5_req = MetrologyAuditRequest(
        certificate_id="cert-005",
        certificate_number="AENS12791-26",
        announced_page_count=6,
        actual_extracted_pages=6,
        calibration_date_str="2026-07-22",
        standard_expiry_date_str="2027-09-01",
        issue_date_str="2026-07-25",
        next_calibration_date_str="2027-07-22",
        temp_celsius=23.5,
        humidity_percent=50.0,
        has_stamp_logo=True,
        has_signature=True,
        measurements=[
            PointInput(point_index=1, grandeur="DC Voltage Source", unit="V", nominal_value=1.0, reference_value=1.00002, measured_value=1.00005, uncertainty_u=0.00008, emt=0.0003),
            PointInput(point_index=2, grandeur="Resistance Simulation", unit="kΩ", nominal_value=10.0, reference_value=10.0005, measured_value=10.0012, uncertainty_u=0.0010, emt=0.005)
        ]
    )

    results = {
        "Certif_1_Resistor": evaluate_certificate_rules(c1_req),
        "Certif_2_Temperature": evaluate_certificate_rules(c2_req),
        "Certif_3_Multimeter": evaluate_certificate_rules(c3_req),
        "Certif_4_Shunt": evaluate_certificate_rules(c4_req),
        "Certif_5_Calibrator": evaluate_certificate_rules(c5_req)
    }

    return results

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT_METROLOGY", "8003"))
    uvicorn.run(app, host="0.0.0.0", port=port)

