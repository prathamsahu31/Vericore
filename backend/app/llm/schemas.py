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
    "ca_turnover_certificate": {
        "legal_name": "Name of the entity the certificate is issued to",
        "pan": "PAN shown on the certificate",
        "turnover_fy1": "Turnover for the most recent financial year",
        "turnover_fy2": "Turnover for the second financial year",
        "turnover_fy3": "Turnover for the third financial year",
    },
    "iso_certificate": {
        "legal_name": "Name of the certified organisation",
        "certificate_number": "Certificate number",
        "standard": "The standard certified against",
        "valid_until": "Expiry date of the certificate",
    },
    "oem_authorisation": {
        "oem_name": "Name of the original equipment manufacturer",
        "legal_name": "Name of the authorised party",
        "product_scope": "Products the authorisation covers",
        "valid_until": "Expiry date of the authorisation",
    },
    "technical_datasheet": {
        "model": "Model designation of the offered equipment",
        "rated_throughput_tpd": "Rated throughput in tonnes per day",
        "material_of_construction": "Materials of construction",
    },
    "declaration_non_blacklisting": {
        "legal_name": "Name of the declaring bidder",
        "pan": "PAN shown on the declaration",
        "declaration_signed": "Whether the declaration is signed",
        "declaration_date": "Date of the declaration",
    },
    "emd_instrument": {
        "legal_name": "Name of the applicant",
        "instrument_type": "Kind of instrument furnished",
        "emd_amount": "Amount of the earnest money deposit",
        "valid_until": "Validity of the instrument",
    },
    "holding_company_undertaking": {
        "legal_name": "Name of the bidding entity",
        "holding_company_name": "Name of the holding company whose resources are relied on",
        "shareholding_percent": "Holding company's shareholding in the bidder",
        "board_resolution_ref": "Board resolution reference",
    },
    "financial_statement": {
        "legal_name": "Name of the entity the statement belongs to",
        "turnover_fy1": "Turnover for the most recent financial year shown",
        "turnover_fy2": "Turnover for the second financial year shown",
        "turnover_fy3": "Turnover for the third financial year shown",
    },
    "epfo_certificate": {
        "epfo_reg_number": "The Employees' Provident Fund (EPFO) registration number",
        "legal_name": "Name of the establishment as registered with EPFO",
        "establishment_type": "Type of establishment (entity/company/general)",
        "registration_date": "Date of EPFO registration",
        "valid_until": "Validity of the registration, where the certificate shows one",
    },
    "esic_certificate": {
        "esic_reg_number": "The Employees' State Insurance (ESIC) registration number",
        "legal_name": "Name of the employer as registered with ESIC",
        "registration_date": "Date of ESIC registration",
        "valid_until": "Validity of the registration, where the certificate shows one",
    },
    "local_content_certificate": {
        "legal_name": "Name of the supplier making the declaration",
        "local_content_percent": "Declared percentage of local content, e.g. '62 percent'",
        "declaration_date": "Date of the local content declaration",
    },
}

KNOWN_DOCUMENT_TYPES: tuple[str, ...] = (*DOCUMENT_SCHEMAS.keys(), "unclassified")


def schema_for(doc_type: str) -> dict[str, str]:
    """Fields worth asking for in this document type. Empty if unknown."""
    return DOCUMENT_SCHEMAS.get(doc_type, {})
