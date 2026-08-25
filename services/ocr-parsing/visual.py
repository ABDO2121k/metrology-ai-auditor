"""Detection of applied marks: the validation cachet and the signature.

A cachet is an ink impression and a signature is a pen stroke. Neither is text,
so neither can be found by searching the OCR transcript — yet that is what this
service used to do, keying on words like "ACCREDITATION". Every certificate in
the sample set carries that word in its footer boilerplate
("L'ACCREDITATION PAR LE SOAC ATTESTE DE LA COMPETENCE..."), so the check
returned True for all of them and the blocking ISO 17025 visual audit passed
without anything ever having been looked at.

What can actually be measured on a scan:

*   Printed content is black. A stamp or a pen signature is applied in coloured
    ink, so saturated colour is positive evidence of an applied mark.
*   The laboratory letterhead and the accreditation logo are also coloured, but
    they sit in a fixed band at the top of every page. Excluding that band
    separates pre-printed branding from marks applied afterwards.
*   Some scans are captured in greyscale, which destroys the colour signal
    entirely. On those, absence of colour proves nothing.

That last point is why the result is a tri-state rather than a boolean. A
document we could not inspect is reported NOT_VERIFIABLE and routed to a human,
never silently passed and never failed.
"""

import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional, Sequence

import numpy as np

from render import RenderedPage

logger = logging.getLogger(__name__)

PRESENT = "PRESENT"
ABSENT = "ABSENT"
NOT_VERIFIABLE = "NOT_VERIFIABLE"

# Fraction of page height occupied by the letterhead. Everything above this is
# pre-printed branding on these templates and is ignored.
LETTERHEAD_FRACTION = float(os.getenv("VISUAL_LETTERHEAD_FRACTION", "0.22"))

# A pixel counts as coloured ink when its RGB spread exceeds this and it is not
# near-white paper.
SATURATION_THRESHOLD = int(os.getenv("VISUAL_SATURATION_THRESHOLD", "45"))
PAPER_LUMINANCE = int(os.getenv("VISUAL_PAPER_LUMINANCE", "225"))

# Percentage of a region that must be coloured ink before we call it a mark.
# Scanner noise and JPEG ringing sit well below this.
COLOUR_MARK_PERCENT = float(os.getenv("VISUAL_COLOUR_MARK_PERCENT", "0.05"))

# Below this, the whole document is treated as a greyscale capture in which no
# colour-based conclusion can be drawn.
COLOUR_CAPABLE_PERCENT = float(os.getenv("VISUAL_COLOUR_CAPABLE_PERCENT", "0.02"))


@dataclass
class VisualEvidence:
    stamp_status: str = NOT_VERIFIABLE
    signature_status: str = NOT_VERIFIABLE
    # True when the scan preserved colour anywhere, so absence is meaningful.
    colour_capable: bool = False
    letterhead_colour_percent: float = 0.0
    validation_zone_colour_percent: float = 0.0
    marks_found_on_pages: List[int] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

    @property
    def stamp_present(self) -> bool:
        """Boolean view for callers that need one, treating unknown as absent."""
        return self.stamp_status == PRESENT

    @property
    def signature_present(self) -> bool:
        return self.signature_status == PRESENT


def _to_rgb(page: RenderedPage) -> Optional[np.ndarray]:
    """Decode a rendered page to an HxWx3 array without extra dependencies."""
    try:
        import fitz

        pix = fitz.Pixmap(page.image_bytes)
        arr = np.frombuffer(pix.samples, dtype=np.uint8)
        arr = arr.reshape(pix.height, pix.width, pix.n)
        if pix.n >= 3:
            return arr[:, :, :3].astype(np.int16)
        # Greyscale render: replicate so the caller can treat it uniformly.
        return np.repeat(arr[:, :, :1], 3, axis=2).astype(np.int16)
    except Exception as exc:  # pragma: no cover - decode is best effort
        logger.warning("Visual analysis could not decode page %s: %s", page.page_number, exc)
        return None


def _colour_ink_mask(rgb: np.ndarray) -> np.ndarray:
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    luminance = rgb.mean(axis=2)
    return (spread > SATURATION_THRESHOLD) & (luminance < PAPER_LUMINANCE)


def analyse(pages: Sequence[RenderedPage]) -> VisualEvidence:
    """Inspect every page for marks applied below the letterhead."""
    evidence = VisualEvidence()
    if not pages:
        evidence.notes.append("No pages were rendered, so no visual check ran")
        return evidence

    letterhead_total = 0.0
    zone_total = 0.0
    inspected = 0

    for page in pages:
        rgb = _to_rgb(page)
        if rgb is None:
            continue
        inspected += 1

        height = rgb.shape[0]
        split = max(1, int(height * LETTERHEAD_FRACTION))

        mask = _colour_ink_mask(rgb)
        letterhead = mask[:split]
        zone = mask[split:]

        letterhead_pct = 100.0 * letterhead.sum() / max(1, letterhead.size)
        zone_pct = 100.0 * zone.sum() / max(1, zone.size)

        letterhead_total = max(letterhead_total, letterhead_pct)
        zone_total = max(zone_total, zone_pct)

        if zone_pct >= COLOUR_MARK_PERCENT:
            evidence.marks_found_on_pages.append(page.page_number)

    if inspected == 0:
        evidence.notes.append("Page images could not be decoded for visual inspection")
        return evidence

    evidence.letterhead_colour_percent = round(letterhead_total, 4)
    evidence.validation_zone_colour_percent = round(zone_total, 4)

    # If colour survives anywhere - typically the accreditation logo - then the
    # capture preserved colour, and its absence lower down is informative.
    evidence.colour_capable = (
        max(letterhead_total, zone_total) >= COLOUR_CAPABLE_PERCENT
    )

    if evidence.marks_found_on_pages:
        evidence.stamp_status = PRESENT
        evidence.signature_status = PRESENT
        evidence.notes.append(
            "Coloured ink found below the letterhead on page(s) "
            + ", ".join(str(p) for p in evidence.marks_found_on_pages)
        )
    elif evidence.colour_capable:
        evidence.stamp_status = ABSENT
        evidence.signature_status = ABSENT
        evidence.notes.append(
            "No coloured cachet or signature found below the letterhead. The "
            f"scan did preserve colour (letterhead reads "
            f"{evidence.letterhead_colour_percent:.2f}% coloured ink), so an "
            "ink mark would have shown. A cachet applied in black ink would "
            "not be distinguishable here and should be confirmed visually."
        )
    else:
        evidence.stamp_status = NOT_VERIFIABLE
        evidence.signature_status = NOT_VERIFIABLE
        evidence.notes.append(
            "The document was captured without colour, so an ink cachet cannot "
            "be distinguished from printed content - a human must confirm it"
        )

    return evidence


def from_vision(payload: dict) -> VisualEvidence:
    """Build evidence from a vision model's reading, which is authoritative."""
    evidence = VisualEvidence()
    stamp = payload.get("has_stamp_logo")
    signature = payload.get("has_signature")

    evidence.stamp_status = (
        PRESENT if stamp else (ABSENT if stamp is not None else NOT_VERIFIABLE)
    )
    evidence.signature_status = (
        PRESENT if signature else (ABSENT if signature is not None else NOT_VERIFIABLE)
    )
    evidence.colour_capable = True
    evidence.notes.append("Cachet and signature read by the vision layer")
    return evidence
