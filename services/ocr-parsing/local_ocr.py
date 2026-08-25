"""Local OCR layer (RapidOCR / ONNX Runtime).

This runs on every certificate, with or without an API key. The sample
certificates in this project carry no text layer at all, so this module is the
only thing standing between a scanned page and structured data when the vision
layer is unavailable.

Lines are kept with their bounding boxes rather than being flattened straight
to a string: the deterministic parser in `parsing.py` needs geometry to tell a
table row apart from a header, and to pair a label with the value sitting to
its right rather than the one that happens to follow in reading order.
"""

import logging
import os
import threading
from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

_ENGINE = None
_ENGINE_ERROR: Optional[str] = None
_ENGINE_LOCK = threading.Lock()

# Lines scoring below this are almost always scanner noise, stray rule marks,
# or fragments of the accreditation seal.
MIN_LINE_SCORE = float(os.getenv("OCR_MIN_LINE_SCORE", "0.45"))


@dataclass
class OCRLine:
    text: str
    score: float
    x0: float
    y0: float
    x1: float
    y1: float
    page_number: int

    @property
    def center_y(self) -> float:
        return (self.y0 + self.y1) / 2.0

    @property
    def height(self) -> float:
        return max(1.0, self.y1 - self.y0)


@dataclass
class PageOCR:
    page_number: int
    lines: List[OCRLine]
    source: str  # LOCAL_OCR or TEXT_LAYER

    @property
    def text(self) -> str:
        return "\n".join(line.text for line in self.lines)


def get_engine():
    """Load the RapidOCR engine once, lazily, and share it across requests.

    Model load is several seconds; doing it per request would push a multi-page
    certificate past the ingestion service's HTTP timeout.
    """
    global _ENGINE, _ENGINE_ERROR
    if _ENGINE is not None or _ENGINE_ERROR is not None:
        return _ENGINE

    with _ENGINE_LOCK:
        if _ENGINE is not None or _ENGINE_ERROR is not None:
            return _ENGINE
        try:
            from rapidocr_onnxruntime import RapidOCR

            _ENGINE = RapidOCR()
            logger.info("RapidOCR engine initialised.")
        except Exception as exc:  # pragma: no cover - depends on runtime wheels
            _ENGINE_ERROR = f"{type(exc).__name__}: {exc}"
            logger.warning("RapidOCR unavailable: %s", _ENGINE_ERROR)
    return _ENGINE


def engine_error() -> Optional[str]:
    return _ENGINE_ERROR


def warmup() -> bool:
    """Force model load at process start so the first real request is fast."""
    return get_engine() is not None


def _box_bounds(box: Sequence) -> Tuple[float, float, float, float]:
    xs = [float(point[0]) for point in box]
    ys = [float(point[1]) for point in box]
    return min(xs), min(ys), max(xs), max(ys)


def ocr_image(image_bytes: bytes, page_number: int) -> List[OCRLine]:
    engine = get_engine()
    if engine is None:
        return []

    try:
        raw, _elapsed = engine(image_bytes)
    except Exception as exc:
        logger.warning("OCR failed on page %s: %s", page_number, exc)
        return []

    if not raw:
        return []

    lines: List[OCRLine] = []
    for item in raw:
        try:
            box, text, score = item[0], item[1], float(item[2])
        except (IndexError, TypeError, ValueError):
            continue
        text = (text or "").strip()
        if not text or score < MIN_LINE_SCORE:
            continue
        x0, y0, x1, y1 = _box_bounds(box)
        lines.append(
            OCRLine(
                text=text,
                score=score,
                x0=x0,
                y0=y0,
                x1=x1,
                y1=y1,
                page_number=page_number,
            )
        )

    # Reading order: top to bottom, then left to right within a band. The band
    # tolerance is a fraction of glyph height so that cells of one table row
    # stay together even when the scan is slightly skewed.
    lines.sort(key=lambda ln: (round(ln.center_y / 12.0), ln.x0))
    return lines


def lines_from_text_layer(text: str, page_number: int) -> List[OCRLine]:
    """Wrap a born-digital page's text so both paths yield the same shape.

    Geometry is unavailable here, so x/y are synthesised from line order. The
    parser's label/value pairing degrades to pure reading order, which is the
    right behaviour for a text-layer PDF.
    """
    lines: List[OCRLine] = []
    for index, raw_line in enumerate(text.splitlines()):
        stripped = raw_line.strip()
        if not stripped:
            continue
        lines.append(
            OCRLine(
                text=stripped,
                score=1.0,
                x0=0.0,
                y0=float(index * 12),
                x1=float(len(stripped) * 6),
                y1=float(index * 12 + 10),
                page_number=page_number,
            )
        )
    return lines


def mean_confidence(pages: List[PageOCR]) -> Optional[float]:
    scores = [line.score for page in pages for line in page.lines]
    if not scores:
        return None
    return round(sum(scores) / len(scores), 4)
