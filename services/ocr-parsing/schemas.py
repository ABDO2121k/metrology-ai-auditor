from pydantic import BaseModel
from typing import List, Optional

class OCRParseRequest(BaseModel):
    certificate_id: str
    file_bytes_path: Optional[str] = None
    s3_path: Optional[str] = None

class MeasurementRow(BaseModel):
    point_index: int
    nominal_value: float
    reference_value: float
    measured_value: float
    unit: str
    calculated_error: float
    calculated_correction: float
    uncertainty_u: float
    emt_limit: float

class ExtractedCertificateData(BaseModel):
    certificate_id: str
    certificate_number: str
    client_name: str
    instrument_name: str
    instrument_serial: str
    announced_page_count: int
    actual_extracted_pages: int
    issue_date: Optional[str]
    calibration_date: Optional[str]
    next_calibration_date: Optional[str]
    ambient_temperature: Optional[str]
    ambient_humidity: Optional[str]
    reference_standard_code: Optional[str]
    reference_standard_expiry: Optional[str]
    has_stamp_logo: bool
    has_signature: bool
    measurements: List[MeasurementRow]
