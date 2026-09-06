"""Tender parser profiles. architecture.md §6.1: two profiles, one output schema.

A GeM custom bid and a classical RFP carry their eligibility criteria in
completely different shapes — the first as structured bilingual metadata, the
second as a numbered pre-qualification table in prose. Detecting which is a
deterministic rule over the document's own text, so it lives here rather than
inside any provider, and both providers share it.
"""

from __future__ import annotations

import enum
import re


class TenderProfile(enum.StrEnum):
    #: Classical RFP / NIT: numbered PQ table, prose criteria, applicability column.
    RFP_PQ_TABLE = "rfp_pq_table"
    #: GeM custom bid: structured key/value metadata, often bilingual.
    GEM_BID = "gem_bid"


def _phrase(text: str) -> str:
    """A phrase matcher tolerant of the line breaks a two-column layout inserts.

    A GeM bid prints Hindi and English side by side, so the English wraps mid
    phrase — "Bid Offer\nValidity", "Document required\nfrom seller". Matching
    literal spaces misses most of them, which is how a GeM bid came to be read
    as a classical RFP.
    """
    return r"\s+".join(re.escape(w) for w in text.split())


# Phrases that appear in a GeM bid and essentially nowhere else. "GeM" itself is
# decisive: a classical RFP does not name the marketplace.
_GEM_STRONG = (r"\bGeM\b", _phrase("GeM Availability Report"), _phrase("Bid Offer Validity"))
_GEM_WEAK = (
    _phrase("Bid End Date"),
    _phrase("MSE Relaxation for Years of Experience"),
    _phrase("Startup Relaxation for Years of Experience"),
    _phrase("Document required from seller"),
    _phrase("Type of Bid"),
    _phrase("ePBG Detail"),
)

# "Technical Qualification" and "Eligibility Criteria" are deliberately absent:
# GeM bids use both phrases in their additional terms, so they do not
# distinguish the two formats and counting them caused a false tie.
_RFP_STRONG = (
    _phrase("Request for Proposal"),
    r"Pre-?\s*Qualification\s+Criteria",
    _phrase("Prequalification Criteria"),
    _phrase("Notice Inviting Tender"),
)
_RFP_WEAK = (
    _phrase("Basic Criteria"),
    _phrase("Documents Required"),
    _phrase("Bidder should be registered"),
)


def detect_profile(text: str) -> TenderProfile:
    """Which shape this tender is. Defaults to the RFP profile.

    The default matters: an RFP profile applied to a GeM bid finds fewer
    criteria, while a GeM profile applied to an RFP would look for metadata
    fields that are not there and find nothing at all. Under-reading is the
    recoverable error.
    """
    head = text[:30000]

    def score(strong, weak) -> int:
        return 3 * sum(1 for p in strong if re.search(p, head, re.IGNORECASE)) + sum(
            1 for p in weak if re.search(p, head, re.IGNORECASE)
        )

    gem = score(_GEM_STRONG, _GEM_WEAK)
    rfp = score(_RFP_STRONG, _RFP_WEAK)
    return TenderProfile.GEM_BID if gem > rfp else TenderProfile.RFP_PQ_TABLE


PROMPT_FOR_PROFILE = {
    TenderProfile.RFP_PQ_TABLE: "extract_requirements_rfp.txt",
    TenderProfile.GEM_BID: "extract_requirements_gem.txt",
}
