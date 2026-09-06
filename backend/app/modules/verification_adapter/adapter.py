"""External verification, behind one interface. CLAUDE.md §8.

Every result carries ``source``. There is no configuration in which a simulated
answer can be presented as live — the field is required on the dataclass, it is
NOT NULL on ``portal_checks``, and it is rendered wherever the result appears.

``status == "unavailable"`` maps to ``UNVERIFIED``, never to ``NON_COMPLIANT``.
A portal being down must never cost a bidder their tender.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, Protocol, runtime_checkable

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[4]
SEED_DIR = REPO_ROOT / "seed" / "verification"

VerificationStatus = Literal["found", "not_found", "invalid_format", "unavailable"]


@dataclass(frozen=True)
class VerificationResult:
    portal_id: str
    identifier: str
    status: VerificationStatus
    data: dict
    retrieved_at: datetime
    # Never omitted, never hidden (CLAUDE.md §2 rule 2).
    source: Literal["live", "simulated"]
    raw_response_hash: str | None = None


@runtime_checkable
class VerificationAdapter(Protocol):
    portal_id: str

    def verify(self, identifier: str, context: dict) -> VerificationResult: ...


# The portals CLAUDE.md §8 names. None of them offer an open API a team can use
# without institutional credentials, which is why all of them are simulated —
# see docs/how-it-works.md for the reasoning, stated in the officer's language.
PORTALS = ("gstn", "udyam", "pan", "mca21", "digilocker", "dpiit", "nsic", "blacklist")

# Deterministic portal assignment, used when a model left ``external_check``
# unset. The mapping runs on document types first (a GST certificate can only
# ever mean the GSTN portal), then on the requirement's own wording — never on
# the bidder's documents. Routing stays a lookup (§21), only the lookup's key
# is made robust to a provider that omits the field.
_PORTAL_BY_DOC_TYPE = {
    "gst_certificate": "gstn",
    "pan_card": "pan",
    "udyam_certificate": "udyam",
    "incorporation_certificate": "mca21",
    "declaration_non_blacklisting": "blacklist",
}

_PORTAL_KEYWORDS: list[tuple[str, str]] = [
    ("digilocker", "digilocker"),
    ("startup india", "dpiit"),
    ("dpiit", "dpiit"),
    ("nsic", "nsic"),
    ("gst", "gstn"),
    ("udyam", "udyam"),
    ("msme", "udyam"),
    ("permanent account number", "pan"),
    ("blacklist", "blacklist"),
    ("debarred", "blacklist"),
    ("companies act", "mca21"),
]


def portal_for(requirement) -> str | None:
    """The portal a requirement should be checked against, if any.

    Returns the stored ``external_check`` when set, and otherwise derives one
    from what the requirement itself says. The derivation is deterministic and
    stateless, so two providers — or no provider at all — cannot disagree about
    which portal a requirement names.
    """
    stored = getattr(requirement, "external_check", None)
    if stored:
        return stored

    for doc_type in requirement.accepts_document_types or []:
        if doc_type in _PORTAL_BY_DOC_TYPE:
            return _PORTAL_BY_DOC_TYPE[doc_type]

    wording = f"{requirement.name or ''} {requirement.normalized_clause or ''}".lower()
    for needle, portal in _PORTAL_KEYWORDS:
        if needle in wording:
            return portal
    return None


@dataclass
class MockProvider:
    """Canned responses from ``seed/verification/<portal>.json``, keyed by identifier.

    The Udyam entries are seeded from the Ministry of MSME's genuinely public
    dataset, which adds real credibility — but the result is still labelled
    ``simulated``, because the label describes how the answer was obtained, not
    how true it is (CLAUDE.md §8).
    """

    portal_id: str
    seed_dir: Path = field(default=SEED_DIR)

    def _table(self) -> dict:
        path = self.seed_dir / f"{self.portal_id}.json"
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            log.warning("verification seed %s is not valid JSON", path.name)
            return {}

    def verify(self, identifier: str, context: dict) -> VerificationResult:
        now = datetime.now(UTC)
        key = (identifier or "").strip().upper()
        table = self._table()

        if not table:
            # No canned data at all: the check did not happen, and we say so
            # rather than inventing an answer.
            return VerificationResult(
                portal_id=self.portal_id,
                identifier=key,
                status="unavailable",
                data={"reason": f"No simulated dataset for portal '{self.portal_id}'."},
                retrieved_at=now,
                source="simulated",
            )

        entry = table.get(key)
        if entry is None:
            return VerificationResult(
                portal_id=self.portal_id,
                identifier=key,
                status="not_found",
                data={},
                retrieved_at=now,
                source="simulated",
            )

        return VerificationResult(
            portal_id=self.portal_id,
            identifier=key,
            status=entry.get("status", "found"),
            data=entry.get("data", {}),
            retrieved_at=now,
            source="simulated",
        )


def get_adapter(portal_id: str) -> VerificationAdapter:
    """The adapter for a portal.

    Only ``MockProvider`` exists. A real adapter slots in here without touching
    anything upstream, which is the whole point of the interface (§8).
    """
    return MockProvider(portal_id=portal_id)
