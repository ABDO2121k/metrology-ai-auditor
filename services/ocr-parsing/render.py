"""Bounded PDF page rasterization.

Calibration certificates arriving from the scanner are pure image PDFs whose
pages are already huge (e.g. 1768x2500 pt). Rendering those at a fixed DPI is
the single most expensive thing this service can do: `get_pixmap(dpi=150)` on
such a page yields a 3684x5209 pixmap that serializes to ~13 MB of PNG. Six of
those, base64-encoded into a vision request, is ~100 MB — far past any model's
request ceiling, and slow enough to blow the caller's timeout on its own.

Instead we scale every page to a bounded longest side and encode JPEG, which
brings the same page to ~250 KB (a ~50x reduction) with no measurable loss of
OCR accuracy at 2000 px.
"""

import io
import os
from dataclasses import dataclass, field
from typing import List, Optional

import fitz  # PyMuPDF


# Longest side, in pixels, of a rendered page. 2000 px keeps 8-9 px glyph
# height for the body text of a scanned A4 certificate, which is comfortably
# above what both RapidOCR and vision models need.
DEFAULT_MAX_SIDE = int(os.getenv("OCR_RENDER_MAX_SIDE", "2000"))

# A higher-resolution pass used only when the first OCR attempt looks thin.
DEFAULT_RETRY_MAX_SIDE = int(os.getenv("OCR_RENDER_RETRY_MAX_SIDE", "3000"))

DEFAULT_JPEG_QUALITY = int(os.getenv("OCR_RENDER_JPEG_QUALITY", "82"))

# Hard ceiling on how many pages we will send to a vision model in one request.
MAX_VISION_PAGES = int(os.getenv("OCR_MAX_VISION_PAGES", "8"))


@dataclass
class RenderedPage:
    page_number: int  # 1-based
    image_bytes: bytes
    mime: str
    width: int
    height: int
    # Text recovered from the PDF's own text layer, if it has one.
    text_layer: str = ""

    @property
    def has_text_layer(self) -> bool:
        return len(self.text_layer.strip()) > 0


@dataclass
class RenderResult:
    pages: List[RenderedPage] = field(default_factory=list)
    max_side: int = DEFAULT_MAX_SIDE
    total_bytes: int = 0
    text_layer_chars: int = 0

    @property
    def page_count(self) -> int:
        return len(self.pages)


def _zoom_for(rect: "fitz.Rect", max_side: int) -> float:
    longest = max(rect.width, rect.height)
    if longest <= 0:
        return 1.0
    zoom = max_side / longest
    # Never upscale beyond 4x: past that we are inventing pixels, paying for
    # them in both OCR time and request size, and gaining nothing.
    return min(zoom, 4.0)


def render_pdf(
    pdf_path: str,
    max_side: int = DEFAULT_MAX_SIDE,
    jpeg_quality: int = DEFAULT_JPEG_QUALITY,
    max_pages: Optional[int] = None,
) -> RenderResult:
    """Rasterize every page to a bounded-size JPEG and pull any text layer."""
    doc = fitz.open(pdf_path)
    try:
        result = RenderResult(max_side=max_side)
        page_limit = len(doc) if max_pages is None else min(len(doc), max_pages)

        for index in range(page_limit):
            page = doc.load_page(index)
            text_layer = page.get_text("text") or ""

            zoom = _zoom_for(page.rect, max_side)
            matrix = fitz.Matrix(zoom, zoom)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)

            # JPEG rather than PNG: these are photographic scans, so PNG's
            # lossless encoding buys nothing and costs ~10x the bytes.
            image_bytes = pixmap.tobytes("jpeg", jpg_quality=jpeg_quality)

            result.pages.append(
                RenderedPage(
                    page_number=index + 1,
                    image_bytes=image_bytes,
                    mime="image/jpeg",
                    width=pixmap.width,
                    height=pixmap.height,
                    text_layer=text_layer,
                )
            )
            result.total_bytes += len(image_bytes)
            result.text_layer_chars += len(text_layer.strip())

        return result
    finally:
        doc.close()


def count_pdf_pages(pdf_path: str) -> int:
    doc = fitz.open(pdf_path)
    try:
        return len(doc)
    finally:
        doc.close()
