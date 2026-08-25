"""Deterministic parsing of French calibration certificates.

Everything here is pure text/geometry work with no network dependency, so it is
the layer that keeps the service useful when no vision model is configured. It
is also the cross-check used to catch a vision model inventing a plausible but
absent value.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

from local_ocr import OCRLine


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

MONTH_MAP = {
    "janvier": "01", "janv": "01", "jan": "01",
    "fevrier": "02", "fevr": "02", "feb": "02", "fev": "02",
    "mars": "03", "mar": "03",
    "avril": "04", "avr": "04", "apr": "04",
    "mai": "05", "may": "05",
    "juin": "06", "jun": "06",
    "juillet": "07", "juil": "07", "jul": "07",
    "aout": "08", "aug": "08",
    "septembre": "09", "sept": "09", "sep": "09",
    "octobre": "10", "oct": "10",
    "novembre": "11", "nov": "11",
    "decembre": "12", "dec": "12",
}

NULL_TOKENS = {"", "-", "--", "/", "#n/a", "n/a", "na", "none", "null", "néant", "neant"}


def strip_accents(value: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFD", value)
        if unicodedata.category(ch) != "Mn"
    )


def normalize(value: str) -> str:
    """Upper-case, accent-free, whitespace-collapsed — for matching only."""
    return re.sub(r"\s+", " ", strip_accents(value or "")).strip().upper()


# OCR on these scans regularly emits CJK/fullwidth punctuation where the
# original had ASCII (e.g. "：113557SBH" for ": 113557SBH").
FULLWIDTH_TRANSLATION = str.maketrans({
    "：": ":", "；": ";", "，": ",", "．": ".",
    "（": "(", "）": ")", "／": "/", "－": "-",
    "℃": "°C", "℉": "°F", "％": "%",
})


def clean_value(value: str) -> str:
    """Normalise punctuation and shed any label words left on the front."""
    text = (value or "").translate(FULLWIDTH_TRANSLATION).strip()
    # Drop leading label continuations: "ambiante : 23 C" -> "23 C".
    for _ in range(3):
        stripped = re.sub(
            r"^(?:relative|ambiante|ambient|de|du|d’|d'|la|le|:|-|°)\s*",
            "", text, flags=re.IGNORECASE,
        )
        if stripped == text:
            break
        text = stripped
    # The fullwidth translation can leave "°°C" when the source already
    # carried a degree sign next to ℃.
    text = re.sub(r"°{2,}", "°", text)
    return text.strip(" :;.,-	")


def is_null_token(value: Optional[str]) -> bool:
    return value is None or value.strip().lower() in NULL_TOKENS


def parse_number(value: Any) -> Optional[float]:
    """Parse a metrology number, tolerating French decimals and OCR noise.

    Handles '1 234,56', '10.005', '±0,05', '< 0.1', and the common OCR
    substitutions of O/o for 0 and l/I for 1 inside an otherwise numeric token.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if is_null_token(text):
        return None

    text = text.replace(" ", " ").replace("−", "-").replace("–", "-")

    # A tolerance expression ("23 ± 2 °C", "20±10℃") carries two numbers.
    # The nominal value is the one before the ±; naively stripping the
    # symbol would splice the pair into one bogus number (20 ± 10 -> 2010).
    tolerance_split = re.split(r"±|\+/-", text, maxsplit=1)
    if len(tolerance_split) > 1 and re.search(r"\d", tolerance_split[0]):
        text = tolerance_split[0]

    text = re.sub(r"[<>≤≥~=]", " ", text).strip()

    # Repair OCR letter/digit confusion only when the token is nearly numeric.
    if re.fullmatch(r"[\d\s.,\-OolIS]+", text) and re.search(r"\d", text):
        text = text.replace("O", "0").replace("o", "0")
        text = text.replace("l", "1").replace("I", "1")
        text = text.replace("S", "5")

    # Digits may only be joined across a space when that space is a thousands
    # separator (trailing groups of exactly three). Otherwise "20 10" is two
    # separate numbers and must not be read as 2010.
    match = re.search(
        r"-?\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?",
        text,
    )
    if not match:
        return None

    token = re.sub(r"[\s ]+", "", match.group(0))

    # A comma is a decimal separator in French; a dot may be either. If both
    # appear, the rightmost one is the decimal separator.
    if "," in token and "." in token:
        if token.rfind(",") > token.rfind("."):
            token = token.replace(".", "").replace(",", ".")
        else:
            token = token.replace(",", "")
    elif "," in token:
        token = token.replace(",", ".")

    try:
        return float(token)
    except ValueError:
        return None


def parse_date(value: Optional[str]) -> Optional[str]:
    """Parse a date to ISO `YYYY-MM-DD`, or return None.

    Ambiguous or impossible dates return None rather than a guess: a wrong date
    silently corrupts the chronology audit, which is a blocking ISO 17025 check.
    """
    if value is None:
        return None
    text = str(value).strip()
    if is_null_token(text):
        return None

    text = strip_accents(text).lower().replace(" ", " ")

    # ISO first — unambiguous.
    iso = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", text)
    if iso:
        year, month, day = int(iso.group(1)), int(iso.group(2)), int(iso.group(3))
        return _build_date(year, month, day)

    # Numeric day/month/year. These certificates are French, so day precedes
    # month; we only reinterpret when the first field cannot be a day.
    numeric = re.search(r"(\d{1,2})[\s/.-](\d{1,2})[\s/.-](\d{2,4})", text)
    if numeric:
        first, second = int(numeric.group(1)), int(numeric.group(2))
        year = _normalize_year(numeric.group(3))
        if first > 12 and second <= 12:
            day, month = first, second
        elif second > 12 and first <= 12:
            # Written month/day — unusual here but unambiguous when it occurs.
            day, month = second, first
        elif first <= 12 and second <= 12:
            day, month = first, second  # French convention
        else:
            return None
        return _build_date(year, month, day)

    # "15 avril 2026" / "15-avr-26"
    worded = re.search(r"(\d{1,2})\s*[\s/.-]\s*([a-z]{3,10})\s*[\s/.-]\s*(\d{2,4})", text)
    if worded:
        day = int(worded.group(1))
        month_name = worded.group(2)
        month = MONTH_MAP.get(month_name)
        if month is None:
            for key, val in MONTH_MAP.items():
                if month_name.startswith(key[:3]):
                    month = val
                    break
        if month is None:
            return None
        return _build_date(_normalize_year(worded.group(3)), int(month), day)

    return None


def _normalize_year(raw: str) -> int:
    year = int(raw)
    if year < 100:
        # Calibration certificates are contemporary documents.
        year += 2000 if year < 80 else 1900
    return year


def _build_date(year: int, month: int, day: int) -> Optional[str]:
    if not (1 <= month <= 12) or not (1 <= day <= 31) or not (1900 <= year <= 2100):
        return None
    import datetime

    try:
        return datetime.date(year, month, day).isoformat()
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Domain detection
# ---------------------------------------------------------------------------

DOMAIN_KEYWORDS: List[Tuple[str, Sequence[str]]] = [
    ("ROTATION-SPEED", (
        "TR/MIN", "TR / MIN", "RPM", "TACHYMETRE", "TACHOMETER", "CENTRIFUGE",
        "CENTRIFUGEUSE", "AGITATEUR", "STIRRER", "VITESSE DE ROTATION",
        "F.CGM", "FICTA",
    )),
    ("ELECTRICITY-MAGNETISM", (
        "MULTIMETRE", "MULTIMETER", "TENSION", "VOLTAGE", "COURANT", "AMPERE",
        "RESISTANCE", "RESISTIVITE", "TELLUROMETRE", "ISOLEMENT",
        "PRISE DE TERRE", "CONTROLEUR DE TERRE", "MEGOHMMETRE", "MEGOHM",
        "OHM", "SHUNT", "CALIBRATEUR", "PINCE AMPEREMETRIQUE", "F.CGE",
    )),
    ("THERMAL", (
        # Deliberately specific: every certificate mentions "temperature
        # ambiante" in its conditions block, so the bare word cannot be a
        # domain signal.
        "PT100", "PT 100", "THERMOCOUPLE", "THERMOMETRE", "THERMOMETER",
        "SONDE DE TEMPERATURE", "CAPTEUR DE TEMPERATURE", "ENREGISTREUR DE TEMPERATURE",
        "ETUVE", "INCUBATEUR", "BAIN THERMOSTATE", "AUTOCLAVE", "FOUR",
        "REFRIGERATEUR", "CONGELATEUR",
    )),
    ("TIMING", (
        "CHRONOMETRE", "CHRONOMETER", "STOPWATCH", "MINUTERIE", "TIMER",
        "COMPTEUR DE TEMPS",
    )),
    ("PRESSURE", (
        "MANOMETRE", "MANOMETER", "PRESSION", "PRESSURE", "BAROMETRE",
        "CAPTEUR DE PRESSION", "PSI",
    )),
    ("MASS", (
        "BALANCE", "MASSE", "PESAGE", "WEIGHING", "POIDS", "PESE-PERSONNE",
    )),
    ("DIMENSIONAL", (
        "PIED A COULISSE", "MICROMETRE", "CALIPER", "DIMENSIONNEL", "JAUGE",
        "COMPARATEUR", "REGLE",
    )),
]

# Units that pin a domain unambiguously, used to sanity-check the label match.
UNIT_DOMAIN = {
    "TR/MIN": "ROTATION-SPEED", "RPM": "ROTATION-SPEED", "MIN-1": "ROTATION-SPEED",
    "°C": "THERMAL", "K": "THERMAL",
    "V": "ELECTRICITY-MAGNETISM", "MV": "ELECTRICITY-MAGNETISM",
    "A": "ELECTRICITY-MAGNETISM", "MA": "ELECTRICITY-MAGNETISM",
    "Ω": "ELECTRICITY-MAGNETISM", "OHM": "ELECTRICITY-MAGNETISM",
    "S": "TIMING", "MIN": "TIMING", "H": "TIMING",
    "BAR": "PRESSURE", "PA": "PRESSURE", "PSI": "PRESSURE",
    "G": "MASS", "KG": "MASS", "MG": "MASS",
    "MM": "DIMENSIONAL", "CM": "DIMENSIONAL", "µM": "DIMENSIONAL",
}

DOMAIN_DEFAULT_UNIT = {
    "ROTATION-SPEED": "tr/min",
    "THERMAL": "°C",
    "ELECTRICITY-MAGNETISM": "V",
    "TIMING": "s",
    "PRESSURE": "bar",
    "MASS": "g",
    "DIMENSIONAL": "mm",
    "UNKNOWN": "",
}


def detect_domain(text: str, units: Optional[Sequence[str]] = None) -> str:
    """Infer the metrological domain from instrument wording and table units.

    Units win over wording: a certificate body may mention 'température
    ambiante' on every page without being a thermal calibration.
    """
    if units:
        votes: Dict[str, int] = {}
        for unit in units:
            key = normalize(unit).replace(" ", "")
            domain = UNIT_DOMAIN.get(key)
            if domain:
                votes[domain] = votes.get(domain, 0) + 1
        if votes:
            return max(votes.items(), key=lambda kv: kv[1])[0]

    haystack = normalize(text)
    for domain, keywords in DOMAIN_KEYWORDS:
        if any(keyword in haystack for keyword in keywords):
            return domain
    return "UNKNOWN"


# ---------------------------------------------------------------------------
# Footer / boilerplate suppression
# ---------------------------------------------------------------------------

# Company footers carry long digit runs (tax IDs, registry numbers, phone
# numbers) that regularly get mistaken for certificate or serial numbers.
FOOTER_PATTERNS = [
    r"IDENTIFIANT\s+FISCAL", r"\bIF\s*[:.]?\s*\d{6,}", r"\bICE\s*[:.]?\s*\d{6,}",
    r"\bR\.?C\.?\s*[:.]?\s*\d{4,}", r"\bPATENTE\b", r"\bCNSS\b",
    r"\bTEL\b", r"\bT[ÉE]L[ÉE]PHONE\b", r"\bFAX\b", r"\bE-?MAIL\b", r"@",
    r"WWW\.", r"HTTPS?://",
    r"\b\d+\s*(?:ER|EME|ÈME)\s+ETAGE\b",
    r"CAPITAL\s+SOCIAL", r"\bSARL\b\s*$", r"\bS\.?A\.?\b\s*$",
    r"PAGE\s+\d+\s*(?:/|SUR|DE)\s*\d+",
]
_FOOTER_RE = re.compile("|".join(FOOTER_PATTERNS), re.IGNORECASE)


def is_footer_line(text: str) -> bool:
    return bool(_FOOTER_RE.search(strip_accents(text)))


def filter_footers(lines: Sequence[OCRLine]) -> List[OCRLine]:
    return [line for line in lines if not is_footer_line(line.text)]


# ---------------------------------------------------------------------------
# Label / value extraction
# ---------------------------------------------------------------------------

@dataclass
class ParsedFields:
    values: Dict[str, str] = field(default_factory=dict)
    sources: Dict[str, str] = field(default_factory=dict)

    def set(self, key: str, value: Optional[str], source: str = "REGEX") -> None:
        if value is None:
            return
        cleaned = clean_value(value)
        if is_null_token(cleaned):
            return
        if key not in self.values:
            self.values[key] = cleaned
            self.sources[key] = source

    def get(self, key: str) -> Optional[str]:
        return self.values.get(key)


# Each field maps to the label variants seen across the lab's form templates.
FIELD_LABELS: Dict[str, Sequence[str]] = {
    "certificate_number": (
        "certificat n", "certificat no", "certificate n", "n° de certificat",
        "numero de certificat", "rapport n", "constat n", "n° du certificat",
    ),
    "client_name": (
        "delivre a", "délivré à", "client", "destinataire", "raison sociale",
        "issued to", "customer",
    ),
    "client_address": ("adresse", "address", "siege"),
    "instrument_name": (
        "designation", "désignation", "instrument", "appareil", "equipement",
        "description", "nature de l'instrument",
    ),
    "manufacturer": ("fabricant", "marque", "manufacturer", "constructeur"),
    "model": ("modele", "modèle", "model", "type"),
    "serial_number": (
        "n° de serie", "no de serie", "numero de serie", "n° serie",
        "no serie", "s/n", "serial number", "serial", "serie",
    ),
    "internal_code": ("code interne", "identification", "n° d'identification", "repere"),
    "calibration_date": (
        "date d'etalonnage", "date etalonnage", "date de l'etalonnage",
        "date de verification", "calibration date", "date de mesure",
    ),
    "issue_date": (
        "date d'emission", "date emission", "date d'edition", "issue date",
        "date du certificat", "fait le",
    ),
    "validation_date": ("date de validation", "valide le", "approuve le"),
    "next_calibration_date": (
        "prochain etalonnage", "prochaine verification", "prochain raccordement",
        "date de prochain", "next calibration", "echeance",
    ),
    "ambient_temperature": ("temperature", "temperature ambiante", "temp ambiante"),
    "ambient_humidity": ("humidite", "humidite relative", "hygrometrie", "%hr"),
    "operator_name": ("etalonne par", "technicien", "operateur", "realise par"),
    "approver_name": ("approuve par", "valide par", "responsable", "verifie par"),
    "form_code": ("formulaire", "form", "ref formulaire", "code formulaire"),
}


# Words that only ever continue a label ("Humidité relative", "Serial number",
# "Instrument étalonné"). Treating one as a value is how "humidite" ended up
# extracting the string "relative".
LABEL_STOPWORDS = {
    "relative", "ambiante", "ambient", "number", "no", "num", "numero",
    "etalonne", "etalonnee", "calibrated", "de", "du", "la", "le", "les",
    "d", "l", "a", "et", "par", "sur", "instrument", "appareil", "date",
    "dates", "conditions", "resultats", "resultat", "results", "mesure",
    "mesures", "identification", "client", "designation", "serie", "serial",
    "reference", "etalon", "etalons", "page", "pages", "certificat",
}


def _is_stopword_value(value: str) -> bool:
    """True when the extracted text is just more of the label."""
    tokens = [t for t in re.split(r"[^a-z0-9]+", strip_accents(value).lower()) if t]
    if not tokens:
        return True
    return all(token in LABEL_STOPWORDS for token in tokens)


# Per-field acceptance tests. A value failing its test is discarded rather than
# stored, so a downstream audit sees an honest "missing" instead of noise.
FIELD_VALIDATORS = {
    "serial_number": lambda v: bool(re.search(r"\d", v)) and len(v.strip()) >= 3,
    "certificate_number": lambda v: bool(re.search(r"\d", v)),
    "calibration_date": lambda v: parse_date(v) is not None,
    "issue_date": lambda v: parse_date(v) is not None,
    "validation_date": lambda v: parse_date(v) is not None,
    "next_calibration_date": lambda v: parse_date(v) is not None,
    "ambient_temperature": lambda v: bool(re.search(r"\d", v)),
    "ambient_humidity": lambda v: bool(re.search(r"\d", v)),
    "client_name": lambda v: len(v.strip()) >= 3,
    "instrument_name": lambda v: len(v.strip()) >= 3,
}


def _accepts(field_name: str, value: str) -> bool:
    if is_null_token(value) or _is_stopword_value(value):
        return False
    validator = FIELD_VALIDATORS.get(field_name)
    return validator(value) if validator else True


def _squash(text: str) -> Tuple[str, List[int]]:
    """Strip spaces for matching, keeping a map back to original offsets.

    OCR on these scans routinely loses inter-word spaces, so the header reads
    "DELIVREA", "Nodeserie", "Dated'emission". Matching on the raw text finds
    none of those labels; matching on a squashed copy finds all of them, and
    the offset map lets us still slice the value out of the original line.
    """
    squashed = []
    offsets = []
    for index, char in enumerate(text):
        if char.isspace():
            continue
        # OCR reads the ordinal mark in "N° de serie" as a letter o about as
        # often as it preserves it, so both spellings are folded together.
        if char in "°º˚":
            char = "o"
        squashed.append(char)
        offsets.append(index)
    return "".join(squashed), offsets


def _label_match(line_text: str, labels: Sequence[str]) -> Optional[str]:
    """Return the inline value if `line_text` opens with one of `labels`.

    Returns "" when the line is a bare label (so the caller knows to look for
    the value in an adjacent cell) and None when the label is absent.
    """
    squashed, offsets = _squash(strip_accents(line_text).lower())
    if not squashed:
        return None

    for label in labels:
        label_squashed = _squash(strip_accents(label).lower())[0]
        if not label_squashed:
            continue

        index = squashed.find(label_squashed)
        # The label must open the line; otherwise we are matching a word buried
        # in prose. Two characters of slack absorbs a stray leading glyph.
        if index == -1 or index > 2:
            continue

        tail_start = index + len(label_squashed)
        if tail_start >= len(offsets):
            remainder = ""
        else:
            remainder = line_text[offsets[tail_start]:]

        # A trailing colon means everything matched so far was the label
        # itself - "INSTRUMENT ETALONNE :" is a section heading, not a value.
        if remainder.rstrip().endswith(":"):
            return ""

        return remainder.lstrip(" :;.\u00b0-\t")

    return None


def _value_to_the_right(line: OCRLine, all_lines: Sequence[OCRLine]) -> Optional[str]:
    """Find the cell horizontally adjacent to a label on the same visual row."""
    candidates = []
    for other in all_lines:
        if other is line or other.page_number != line.page_number:
            continue
        if other.x0 < line.x1 - 2:
            continue
        # Same row if the vertical centres are within half a glyph height.
        if abs(other.center_y - line.center_y) > line.height * 0.6:
            continue
        candidates.append(other)
    if not candidates:
        return None
    candidates.sort(key=lambda ln: ln.x0)
    return candidates[0].text


def _value_below(line: OCRLine, all_lines: Sequence[OCRLine]) -> Optional[str]:
    """Find the cell directly beneath a label.

    Header blocks on these certificates stack the label above its value
    ("DELIVRE A" with the client name on the next line), so a right-hand
    lookup alone misses them.
    """
    candidates = []
    for other in all_lines:
        if other is line or other.page_number != line.page_number:
            continue
        gap = other.center_y - line.center_y
        # Directly below: within roughly two text lines.
        if gap <= line.height * 0.4 or gap > line.height * 2.5:
            continue
        # Horizontally overlapping the label's column.
        if other.x1 < line.x0 - line.height or other.x0 > line.x1 + line.height * 4:
            continue
        candidates.append((gap, other))
    if not candidates:
        return None
    candidates.sort(key=lambda pair: pair[0])
    return candidates[0][1].text


def extract_fields(lines: Sequence[OCRLine]) -> ParsedFields:
    """Pull labelled values using inline text first, then table geometry."""
    parsed = ParsedFields()
    body = filter_footers(lines)

    for field_name, labels in FIELD_LABELS.items():
        for line in body:
            inline = _label_match(line.text, labels)
            if inline is None:
                continue

            if _accepts(field_name, inline):
                parsed.set(field_name, inline, "REGEX")
                break

            # Bare label, or a tail that failed validation: the real value
            # sits either in the next cell to the right or directly below.
            matched = False
            for finder in (_value_to_the_right, _value_below):
                neighbour = finder(line, body)
                if neighbour and _accepts(field_name, clean_value(neighbour)):
                    parsed.set(field_name, neighbour, "LAYOUT")
                    matched = True
                    break
            if matched:
                break

    _extract_certificate_number_fallback(body, parsed)
    return parsed


CERT_NUMBER_RE = re.compile(r"(?<![A-Z0-9])([A-Z]{2,5}\d{4,8}-\d{2}(?:/[A-Z])?)(?![A-Z0-9])")


def _strip_number_marker(code: str) -> str:
    """Remove an OCR-glued "N" marker from the front of a certificate code."""
    match = re.match(r"^([A-Z]{2,5})(\d{4,8}-\d{2}(?:/[A-Z])?)$", code)
    if not match:
        return code
    letters, rest = match.group(1), match.group(2)
    if len(letters) == 5 and letters.startswith("N"):
        return letters[1:] + rest
    return code


def _extract_certificate_number_fallback(lines: Sequence[OCRLine], parsed: ParsedFields) -> None:
    """Recognise the lab's certificate-number shape (e.g. ARRM13388-26/A).

    Only used when no labelled match was found, and never on footer lines, so a
    tax identifier cannot be promoted into this slot.
    """
    if parsed.get("certificate_number"):
        return
    for line in lines:
        haystack = clean_value(line.text).upper().replace(" ", "")
        # Strip the number marker so "N°ARRM13388-26" and "N'ARRM13388-26"
        # both reduce to the bare code.
        haystack = re.sub(r"N[°º˚'’.]+", "", haystack)
        match = CERT_NUMBER_RE.search(haystack)
        if match:
            parsed.set("certificate_number", _strip_number_marker(match.group(1)), "PATTERN")
            return


AMENDMENT_MARKERS = ("ANNULE ET REMPLACE", "CANCELS AND REPLACES", "AMENDEMENT", "REVISION")


def detect_amendment(cert_number: Optional[str], full_text: str) -> Tuple[bool, Optional[str]]:
    haystack = normalize(full_text)
    marker_hit = any(marker in haystack for marker in AMENDMENT_MARKERS)
    suffix_hit = bool(cert_number and re.search(r"/[A-Z]$", cert_number.strip().upper()))

    if not (marker_hit or suffix_hit):
        return False, None

    superseded = None
    if suffix_hit and cert_number:
        superseded = re.sub(r"/[A-Z]$", "", cert_number.strip().upper())
    return True, superseded


# ---------------------------------------------------------------------------
# Environmental conditions
# ---------------------------------------------------------------------------

def extract_temperature(text: str) -> Tuple[Optional[str], Optional[float]]:
    match = re.search(
        r"(?:temp[ée]rature)[^:\n]*[:\s]\s*([^\n]{0,40})",
        strip_accents(text), re.IGNORECASE,
    )
    raw = match.group(1).strip() if match else None
    if raw is None:
        match = re.search(r"(\d{1,2}(?:[.,]\d+)?)\s*(?:±|\+/-)\s*\d+(?:[.,]\d+)?\s*°?\s*C", text)
        raw = match.group(0).strip() if match else None
    return raw, parse_number(raw) if raw else None


def extract_humidity(text: str) -> Tuple[Optional[str], Optional[float]]:
    match = re.search(
        r"(?:humidit[ée]|hygrom[ée]trie)[^:\n]*[:\s]\s*([^\n]{0,40})",
        strip_accents(text), re.IGNORECASE,
    )
    raw = match.group(1).strip() if match else None
    if raw is None:
        match = re.search(r"(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:HR|RH)", text, re.IGNORECASE)
        raw = match.group(0).strip() if match else None
    return raw, parse_number(raw) if raw else None


# ---------------------------------------------------------------------------
# Measurement table recovery
# ---------------------------------------------------------------------------

# Units are frequently printed flush against their value ("100.0mV"), where a
# leading word-boundary anchor would never match, because digit-to-letter is
# not a word boundary.
#
# The spellings below are the ones RapidOCR actually produces on these scans,
# not the ones the certificates print. In particular the ohm sign comes back as
# "Q" (and "k²" for kilohm) often enough that omitting it discarded an entire
# resistance certificate's measurement table. Micro arrives as Greek mu
# (U+03BC) rather than the micro sign (U+00B5).
#
# Compound units are listed before their prefixes so that "kΩ" is not consumed
# as a bare "K" under IGNORECASE. Bare Kelvin is deliberately absent: matching
# is case-insensitive, so it would also swallow the lowercase "k" left behind
# when OCR drops the omega. Thermal certificates print °C.
UNIT_TOKEN_RE = re.compile(
    r"(?<![A-Za-z])("
    r"tr\s*/\s*min|min-1|rpm|"
    # Ohm, including the Q / ² misreads.
    r"kΩ|MΩ|mΩ|Ω|kohm|Mohm|ohm|kQ|MQ|k²|M²|Q|²|"
    r"°C|°F|"
    r"mV|kV|µV|μV|mA|µA|μA|"
    r"mbar|kPa|hPa|psi|bar|Pa|"
    r"µm|μm|mm|cm|km|"
    r"µs|μs|ms|"
    r"mg|kg|"
    r"min|"
    r"V|A|s|h|g|m|%"
    r")(?![A-Za-z])",
    re.IGNORECASE,
)

# Fold the OCR spellings onto the real unit so rows that differ only by
# recognition noise group together.
UNIT_CANONICAL = {
    "q": "Ω", "kq": "kΩ", "mq": "MΩ",
    "k²": "kΩ", "m²": "MΩ", "²": "Ω",
    "ohm": "Ω", "kohm": "kΩ", "mohm": "MΩ",
    "μa": "µA", "μv": "µV",
    "μm": "µm", "μs": "µs",
    "rpm": "tr/min", "min-1": "tr/min",
}


def canonical_unit(unit: Optional[str]) -> Optional[str]:
    """Map an OCR-rendered unit onto its real symbol."""
    if not unit:
        return unit
    cleaned = re.sub(r"\s+", "", unit)
    return UNIT_CANONICAL.get(cleaned.lower(), cleaned)


NUMERIC_TOKEN_RE = re.compile(r"-?\d+(?:[.,]\d+)?")


@dataclass
class RawTableRow:
    page_number: int
    numbers: List[float]
    unit: Optional[str]
    text: str


def find_table_rows(lines: Sequence[OCRLine], min_numbers: int = 3) -> List[RawTableRow]:
    """Group OCR lines into visual rows and keep those that look like data.

    A measurement row is a horizontal band holding several numeric cells. We
    rebuild bands from geometry because OCR emits each table cell as its own
    line, so a row is never a single string.
    """
    body = filter_footers(lines)
    if not body:
        return []

    by_page: Dict[int, List[OCRLine]] = {}
    for line in body:
        by_page.setdefault(line.page_number, []).append(line)

    rows: List[RawTableRow] = []
    for page_number, page_lines in sorted(by_page.items()):
        page_lines = sorted(page_lines, key=lambda ln: ln.center_y)
        band: List[OCRLine] = []
        band_y: Optional[float] = None

        for line in page_lines:
            tolerance = line.height * 0.7
            if band_y is None or abs(line.center_y - band_y) <= tolerance:
                band.append(line)
                band_y = line.center_y if band_y is None else (band_y + line.center_y) / 2
            else:
                rows.extend(_band_to_row(band, page_number, min_numbers))
                band = [line]
                band_y = line.center_y
        rows.extend(_band_to_row(band, page_number, min_numbers))

    return rows


def _band_to_row(band: List[OCRLine], page_number: int, min_numbers: int) -> List[RawTableRow]:
    if not band:
        return []
    band = sorted(band, key=lambda ln: ln.x0)
    text = " ".join(line.text for line in band)

    numbers = [
        value for value in (parse_number(tok) for tok in NUMERIC_TOKEN_RE.findall(text))
        if value is not None
    ]
    if len(numbers) < min_numbers:
        return []

    unit_match = UNIT_TOKEN_RE.search(text)
    # Fold OCR spellings (Q, k2, Greek mu) onto the real symbol so rows that
    # differ only by recognition noise land in the same group.
    unit = canonical_unit(unit_match.group(1)) if unit_match else None
    return [RawTableRow(page_number=page_number, numbers=numbers, unit=unit, text=text)]


def collect_units(rows: Sequence[RawTableRow]) -> List[str]:
    return [row.unit for row in rows if row.unit]
