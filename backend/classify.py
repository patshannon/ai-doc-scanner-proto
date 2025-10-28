"""
Document classification and extraction helpers.

All heuristics are intentionally lightweight so the prototype can run quickly
and without external services.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Tuple

from dateutil import parser as date_parser
from rapidfuzz import fuzz


DOC_TYPE_KEYWORDS: Dict[str, Iterable[str]] = {
    "invoice": (
        "invoice",
        "invoice number",
        "bill to",
        "amount due",
        "remit to",
        "purchase order",
    ),
    "receipt": (
        "receipt",
        "thank you for shopping",
        "cashier",
        "pos",
        "change due",
    ),
    "contract": (
        "agreement",
        "contract",
        "terms and conditions",
        "effective date",
    ),
    "insurance": (
        "policy",
        "coverage",
        "premium",
        "claim number",
    ),
    "tax": (
        "tax",
        "irs",
        "revenue agency",
        "h&r block",
        "form t",
    ),
    "medical": (
        "patient",
        "diagnosis",
        "clinic",
        "physician",
        "healthcare",
    ),
    "school": (
        "university",
        "college",
        "transcript",
        "semester",
        "student id",
    ),
    "id": (
        "passport",
        "driver license",
        "identification",
        "national id",
        "dob",
    ),
}

BASE_CONFIDENCE = {
    "invoice": 0.6,
    "receipt": 0.55,
    "contract": 0.55,
    "insurance": 0.5,
    "tax": 0.55,
    "medical": 0.5,
    "school": 0.5,
    "id": 0.45,
    "other": 0.4,
}

TOTAL_PATTERNS = (
    re.compile(r"(?:total(?: amount)?|amount due|balance due)\D{0,12}([\$€£₹]?\s?[A-Z]{0,3}?\s?\d[\d,]*(?:\.\d{2})?)", re.IGNORECASE),
    re.compile(r"\$?\s?[A-Z]{0,3}?\s?\d[\d,]*\.\d{2}\s*(?:total|amount due)", re.IGNORECASE),
)

INVOICE_NUMBER_PATTERN = re.compile(
    r"(?:invoice|inv)\s*(?:number|no\.?|#)?\s*[:#]?\s*([A-Z0-9\-]{3,})",
    re.IGNORECASE,
)

DATE_PATTERNS = (
    re.compile(r"(?:date|dated|issued)\s*[:\-]?\s*([0-9]{4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,2})", re.IGNORECASE),
    re.compile(r"(?:date|dated|issued)\s*[:\-]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})", re.IGNORECASE),
)

HEADER_EXCLUSIONS = (
    "invoice",
    "receipt",
    "total",
    "amount due",
    "bill to",
    "ship to",
    "page",
    "date",
    "customer",
    "due",
    "description",
    "account",
    "statement",
    "balance",
    "subtotal",
    "tax",
)

CURRENCY_CODES = {
    "cad": "CAD",
    "usd": "USD",
    "eur": "EUR",
    "gbp": "GBP",
    "aud": "AUD",
    "nzd": "NZD",
}

CURRENCY_SYMBOLS = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "₹": "INR",
}


def normalize_text(text: str) -> str:
    """Collapse whitespace and lowercase for matching."""
    return " ".join(text.lower().split())


def classify_document(text: str) -> Tuple[str, float, str]:
    """
    Return (doc_type, base_confidence, applied_rule).

    The applied_rule is a short label explaining which heuristic matched.
    """
    normalized = normalize_text(text)
    best_type = "other"
    best_score = 0
    applied_rule = "fallback"

    for doc_type, keywords in DOC_TYPE_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if keyword in normalized:
                score += 2
            else:
                # allow fuzzy matches for minor typos
                candidate = _best_fuzzy_match(normalized, keyword)
                if candidate >= 88:
                    score += 1
        if score > best_score:
            best_score = score
            best_type = doc_type
            applied_rule = f"keyword:{doc_type}"

    return best_type, BASE_CONFIDENCE.get(best_type, 0.4), applied_rule


def _best_fuzzy_match(normalized_text: str, keyword: str) -> int:
    """Compute the best fuzzy partial ratio for the keyword."""
    if len(keyword) < 5:
        return 0
    return fuzz.partial_ratio(keyword, normalized_text)


def extract_invoice_number(text: str) -> Optional[str]:
    match = INVOICE_NUMBER_PATTERN.search(text)
    if match:
        return match.group(1).strip()[:64]
    return None


def extract_total_and_currency(text: str) -> Tuple[Optional[float], Optional[str]]:
    for pattern in TOTAL_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        fragment = match.group(0)
        amount_str = match.group(1) if match.lastindex else fragment
        amount = _parse_amount(amount_str)
        currency = _infer_currency(fragment)
        if amount is not None:
            return amount, currency
    return None, None


def extract_vendor(text: str) -> Optional[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for raw_line in lines[:12]:
        line = raw_line.strip()
        lower = line.lower()
        if any(exclusion in lower for exclusion in HEADER_EXCLUSIONS):
            continue
        if len(line) <= 2 or len(line) > 60:
            continue
        if _looks_like_address(line):
            continue
        if re.search(r"\d{2,}", line):
            continue
        return line[:120]
    return None


def extract_person_or_org(text: str) -> Optional[str]:
    lines = [line.strip() for line in text.splitlines()]
    for idx, line in enumerate(lines):
        lower = line.lower()
        if "bill to" in lower or "sold to" in lower:
            for follow in lines[idx + 1 : idx + 4]:
                cleaned = follow.strip()
                if not cleaned:
                    continue
                if re.search(r"\d{4,}", cleaned):
                    continue
                return cleaned[:120]
    return None


def extract_date(text: str) -> Optional[str]:
    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            parsed = _parse_date(match.group(1))
            if parsed:
                return parsed

    # fallback: search for ISO-like dates anywhere
    iso_match = re.search(r"\b([0-9]{4})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12][0-9]|3[01])\b", text)
    if iso_match:
        parsed = _parse_date(iso_match.group(0))
        if parsed:
            return parsed
    return None


def resolve_date(extracted_date: Optional[str], exif_date: Optional[str]) -> Optional[str]:
    if extracted_date:
        return extracted_date
    if not exif_date:
        return None
    return _parse_date(exif_date)


def _parse_date(value: str) -> Optional[str]:
    try:
        parsed = date_parser.parse(value, fuzzy=True)
    except Exception:
        return None
    return parsed.date().isoformat()


def _parse_amount(value: str) -> Optional[float]:
    cleaned = re.sub(r"[^0-9.]", "", value)
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def _infer_currency(fragment: str) -> Optional[str]:
    fragment_lower = fragment.lower()
    for code_key, code in CURRENCY_CODES.items():
        if code_key in fragment_lower:
            return code
    for symbol, code in CURRENCY_SYMBOLS.items():
        if symbol in fragment:
            return code
    return None


def _looks_like_address(line: str) -> bool:
    return bool(re.search(r"\d{1,5}\s+\w+", line))


def estimate_confidence(base_confidence: float, fields: Dict[str, Optional[str]]) -> float:
    bonus = 0.0
    if fields.get("vendor"):
        bonus += 0.12
    if fields.get("invoiceNumber"):
        bonus += 0.1
    if fields.get("total"):
        bonus += 0.1
    if fields.get("date"):
        bonus += 0.08
    if fields.get("personOrOrg"):
        bonus += 0.05
    return round(min(base_confidence + bonus, 0.95), 2)


def make_title(
    doc_date: Optional[str],
    doc_type: str,
    vendor: Optional[str],
    invoice_number: Optional[str],
) -> str:
    pieces: List[str] = []
    if doc_date:
        pieces.append(doc_date)
    doc_type_slug = _format_title_part(doc_type, fallback="Document")
    pieces.append(_humanize_slug(doc_type_slug))
    if vendor:
        vendor_slug = _format_title_part(vendor, max_len=24)
        pieces.append(_humanize_slug(vendor_slug))
    if invoice_number:
        invoice_slug = _format_title_part(invoice_number, max_len=16)
        pieces.append(f"#{invoice_slug.upper()}")
    title = "_".join(pieces)
    return title[:80]


def build_tags(doc_type: str, vendor: Optional[str]) -> List[str]:
    tags: List[str] = [doc_type]
    if vendor:
        slug = _slugify(vendor)
        if slug:
            tags.append(slug)
    return tags


def build_folder_path(doc_type: str, doc_date: Optional[str]) -> str:
    year = (doc_date or datetime.utcnow().date().isoformat())[:4]
    folder_type = {"id": "ID"}.get(doc_type, doc_type.capitalize())
    return f"Documents/{folder_type}/{year}"


def _format_title_part(value: str, fallback: str = "", max_len: int = 32) -> str:
    slug = _slugify(value)
    if not slug:
        slug = _slugify(fallback) if fallback else "Document"
    return slug[:max_len]


def _slugify(value: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9]+", "-", value.strip())
    sanitized = re.sub(r"-{2,}", "-", sanitized)
    return sanitized.strip("-").lower()


def _humanize_slug(value: str) -> str:
    if not value:
        return "Document"
    words = value.split("-")
    return "-".join(word.capitalize() for word in words if word)
