"""Optional vision-model extraction layer.

This refines what the local pipeline already produced. It is strictly
optional: with no `OPENAI_API_KEY` the service still returns a complete result
from the local OCR path, and the caller is told through the diagnostics which
engines actually ran.

The model is given both the page images *and* the local OCR transcript. Two
independent readings of the same page make hallucination detectable: anything
the model reports that the transcript cannot corroborate is downgraded rather
than silently trusted.
"""

import base64
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Sequence

from render import RenderedPage

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI

    OPENAI_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    OPENAI_AVAILABLE = False

VISION_MODEL = os.getenv("OCR_VISION_MODEL", "gpt-4o")
VISION_TIMEOUT = float(os.getenv("OCR_VISION_TIMEOUT", "90"))
VISION_MAX_RETRIES = int(os.getenv("OCR_VISION_MAX_RETRIES", "2"))

# The old 3000-token ceiling truncated the JSON mid-table on any certificate
# with more than a handful of measurement points, which surfaced as a parse
# failure and an empty result. Table-heavy certificates need real headroom.
VISION_MAX_TOKENS = int(os.getenv("OCR_VISION_MAX_TOKENS", "16000"))


SYSTEM_PROMPT = """You are an expert ISO/IEC 17025 metrology document auditor.
You receive the scanned pages of one calibration certificate plus a raw OCR
transcript of those same pages. Return a single JSON object describing what is
actually printed.

ABSOLUTE RULES
1. TRANSCRIBE, DO NOT INFER. Every value must be visibly printed on a page. If
   a field is absent, unreadable, or you are unsure, use null. Never substitute
   a plausible default, an example value, or a value carried over from another
   certificate. A null is always better than a guess.
2. USE THE TRANSCRIPT AS A CROSS-CHECK. Where the image and the OCR transcript
   disagree, trust the image, but only report a value you can actually see.
3. UNITS MUST MATCH THE TABLE. Copy the unit exactly as printed next to the
   measurement column ("tr/min", "°C", "mV", "Ω", ...). Never normalise a unit
   into a different quantity - a rotational speed is never reported in volts.
4. HEADER IS NOT FOOTER. Page footers carry company tax and registry numbers
   (IF, ICE, RC, patente), addresses, phone numbers and "page x/y" markers.
   These are never the certificate number, the serial number, or a measurement.
   The certificate number sits in the top header, typically shaped like
   "ARRM13388-26" or "ARTL05391-26/A".
5. AMENDMENTS. A trailing "/A" on the certificate number, or wording such as
   "annule et remplace" / "cancels and replaces", means this supersedes an
   earlier certificate. Set is_amendment and superseded_certificate.
6. MEASUREMENTS. Transcribe every row of every measurement table across all
   pages. Report the error exactly as printed in recorded_error - do not
   recompute it. The auditor downstream recomputes it independently and
   compares, so an altered value destroys that check.
7. DATES. Use YYYY-MM-DD. These are French documents: 04/05/2026 is 4 May 2026.

OUTPUT SCHEMA (JSON object, no prose):
{
  "certificate_number": string|null,
  "form_code": string|null,
  "domain": "ROTATION-SPEED"|"ELECTRICITY-MAGNETISM"|"THERMAL"|"TIMING"|"PRESSURE"|"MASS"|"DIMENSIONAL"|"UNKNOWN",
  "is_amendment": boolean,
  "superseded_certificate": string|null,
  "announced_pages": integer|null,
  "client_name": string|null,
  "client_address": string|null,
  "instrument_name": string|null,
  "manufacturer": string|null,
  "model": string|null,
  "serial_number": string|null,
  "internal_code": string|null,
  "issue_date": string|null,
  "calibration_date": string|null,
  "validation_date": string|null,
  "next_calibration_date": string|null,
  "ambient_temperature": string|null,
  "ambient_humidity": string|null,
  "reference_standards": [
    {"designation": string, "connection_code": string|null, "validity_date": string|null}
  ],
  "has_stamp_logo": boolean,
  "has_signature": boolean,
  "operator_name": string|null,
  "approver_name": string|null,
  "measurements": [
    {
      "point_index": integer,
      "parameter": string|null,
      "nominal_value": number|null,
      "reference_value": number|null,
      "measured_value": number|null,
      "unit": string|null,
      "recorded_error": number|null,
      "uncertainty_u": number|null,
      "emt_limit": number|null,
      "is_return_point": boolean
    }
  ],
  "unreadable_fields": [string]
}
"""


def is_configured() -> bool:
    return OPENAI_AVAILABLE and bool(os.getenv("OPENAI_API_KEY"))


def _client() -> Optional["OpenAI"]:
    if not is_configured():
        return None
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=VISION_TIMEOUT)


def _image_part(page: RenderedPage) -> Dict[str, Any]:
    encoded = base64.b64encode(page.image_bytes).decode("utf-8")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{page.mime};base64,{encoded}", "detail": "high"},
    }


def extract(
    pages: Sequence[RenderedPage],
    ocr_transcript: str,
    max_pages: int = 8,
) -> Dict[str, Any]:
    """Run the vision pass. Returns {"data": ..., "error": ..., "model": ...}."""
    client = _client()
    if client is None:
        reason = (
            "openai package not installed"
            if not OPENAI_AVAILABLE
            else "OPENAI_API_KEY not set"
        )
        return {"data": None, "error": reason, "model": None}

    selected = list(pages)[:max_pages]
    skipped = len(pages) - len(selected)

    transcript = ocr_transcript.strip()
    if len(transcript) > 24000:
        transcript = transcript[:24000] + "\n[...transcript truncated...]"

    instruction = (
        f"This certificate has {len(pages)} page(s); "
        f"{len(selected)} image(s) are attached"
        + (f" ({skipped} trailing page(s) omitted)." if skipped else ".")
        + "\n\nRaw OCR transcript of these pages (may contain recognition "
        "errors - use it only to corroborate what you see):\n"
        f"<transcript>\n{transcript or '(no text recovered locally)'}\n</transcript>\n\n"
        "Extract the certificate as JSON per the schema."
    )

    content: List[Dict[str, Any]] = [{"type": "text", "text": instruction}]
    content.extend(_image_part(page) for page in selected)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]

    last_error: Optional[str] = None
    for attempt in range(1, VISION_MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=VISION_MODEL,
                response_format={"type": "json_object"},
                messages=messages,
                temperature=0.0,
                max_tokens=VISION_MAX_TOKENS,
            )
            choice = response.choices[0]
            payload = choice.message.content or ""

            if choice.finish_reason == "length":
                # Truncated JSON cannot be trusted even if it happens to parse.
                last_error = (
                    "vision response hit the token ceiling; "
                    "measurement table is likely incomplete"
                )
                logger.warning(last_error)
                return {"data": None, "error": last_error, "model": VISION_MODEL}

            return {"data": json.loads(payload), "error": None, "model": VISION_MODEL}

        except json.JSONDecodeError as exc:
            last_error = f"vision returned invalid JSON: {exc}"
        except Exception as exc:  # network, auth, rate limit
            last_error = f"{type(exc).__name__}: {exc}"

        logger.warning("Vision attempt %s/%s failed: %s", attempt, VISION_MAX_RETRIES, last_error)
        if attempt < VISION_MAX_RETRIES:
            time.sleep(min(2 ** attempt, 8))

    return {"data": None, "error": last_error, "model": VISION_MODEL}
