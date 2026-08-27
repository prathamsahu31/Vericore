"""Per-document-type field schemas.

These are the ``schema`` argument of ``extract_evidence`` (CLAUDE.md §7.1) and
the vocabulary that ``requirements.accepts_document_types`` and
``requirements.required_fields`` are drawn from, so routing (§21) is a lookup
against a fixed list rather than a guess.
"""

from __future__ import annotations

# field name -> human description handed to the model.
DOCUMENT_SCHEMAS: dict[str, dict[str, str]] = {
    "gst_certificate": {
        "gstin": "The 15-character GST identification number",
        "legal_name": "Legal name of the registered business",
        "trade_name": "Trade name, if shown separately from the legal name",
        "registration_date": "Date of registration/liability",
        "registration_status": "Whether the registration is active or cancelled",
    },
    "pan_card": {
        "pan": "The 10-character permanent account number",
        "legal_name": "Name of the PAN holder",
    },
    "udyam_certificate": {
        "udyam_urn": "The Udyam registration number, format UDYAM-XX-00-0000000",
        "enterprise_name": "Name of the enterprise",
        "enterprise_type": "Micro, Small or Medium",
        "registration_date": "Date of Udyam registration",
    },
    "incorporation_certificate": {
        "cin": "The 21-character corporate identity number",
        "legal_name": "Name of the company as incorporated",
        "incorporation_date": "Date of incorporation",
    },
    "work_order": {
        "order_number": "Work order or purchase order reference",
        "order_value": "Contract value in rupees",
        "client_name": "Name of the awarding organisation",
        "completion_date": "Date of completion",
        "work_description": "Description of the work performed",
    },
    "financial_statement": {
        "legal_name": "Name of the entity the statement belongs to",
        "turnover_fy1": "Turnover for the most recent financial year shown",
        "turnover_fy2": "Turnover for the second financial year shown",
        "turnover_fy3": "Turnover for the third financial year shown",
    },
}

KNOWN_DOCUMENT_TYPES: tuple[str, ...] = (*DOCUMENT_SCHEMAS.keys(), "unclassified")


def schema_for(doc_type: str) -> dict[str, str]:
    """Fields worth asking for in this document type. Empty if unknown."""
    return DOCUMENT_SCHEMAS.get(doc_type, {})
