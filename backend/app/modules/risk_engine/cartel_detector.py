"""Signals that bids on the same tender are not independent of each other.

Bid rigging needs bidders that look separate but are not. Each signal here is a
plain comparison between bids on one tender: the same bidder twice, the same
file, the same registration or certificate number, the same registered address.
Like every other deterministic check (CLAUDE.md §9) it is exact, free and
explainable, and like every risk flag it is a reason to look, never a finding of
collusion. The officer decides (§2).

Bids linked directly or through other bids form a group. A ring rarely shows as
a single pair, so a group of three or more is reported as well.
"""

from __future__ import annotations

import re
import uuid
from collections import defaultdict
from dataclasses import dataclass

from app.db.enums import Severity
from app.modules.risk_engine.service import RiskFlag

CATEGORY = "collusion"

# Extracted fields that identify one business or one specific document. Two
# independent bidders cannot legitimately hold the same one.
IDENTIFIER_FIELDS = {
    "pan": "PAN",
    "gstin": "GSTIN",
    "udyam_urn": "Udyam URN",
    "cin": "CIN",
    "epfo_reg_number": "EPFO registration number",
    "esic_reg_number": "ESIC registration number",
    "certificate_number": "certificate number",
    "order_number": "work order number",
}

# Shorter values are placeholders ("NA", "-", "1"), not identifiers. So is any
# value without a non-zero digit ("TEST-ESIC-000000"): every registration and
# certificate number issued in India carries one.
_MIN_IDENTIFIER_CHARS = 6
_NONZERO_DIGIT = re.compile(r"[1-9]")
# Shorter addresses ("Chennai") name a place, not a premises.
_MIN_ADDRESS_CHARS = 15

_NOT_ALNUM = re.compile(r"[^0-9A-Z]")
_PUNCTUATION = re.compile(r"[^\w\s]")


@dataclass(frozen=True)
class Mark:
    """Something a bid carries that no other bid on the tender should share.

    ``kind`` is ``bidder``, ``document``, ``address`` or a key of
    ``IDENTIFIER_FIELDS``. ``value`` is compared across bids; ``label`` is what
    the officer reads; ``where`` says where in the bid it came from.
    """

    kind: str
    value: str
    label: str
    where: str


@dataclass(frozen=True)
class BidProfile:
    bid_id: uuid.UUID
    name: str  # the lead bidder's legal name, for descriptions
    marks: tuple[Mark, ...]


@dataclass(frozen=True)
class Link:
    """One mark shared by two bids."""

    bid_a: uuid.UUID
    bid_b: uuid.UUID
    kind: str
    label: str
    where_a: str
    where_b: str


def _key(mark: Mark) -> str | None:
    """The comparable form of a mark, or None when it is too weak to compare."""
    if mark.kind in ("bidder", "document"):
        return mark.value
    if mark.kind == "address":
        address = " ".join(_PUNCTUATION.sub(" ", mark.value.casefold()).split())
        return address if len(address) >= _MIN_ADDRESS_CHARS else None
    identifier = _NOT_ALNUM.sub("", mark.value.upper())
    if len(identifier) < _MIN_IDENTIFIER_CHARS or not _NONZERO_DIGIT.search(identifier):
        return None
    return identifier


def find_links(profiles: list[BidProfile]) -> list[Link]:
    """Every mark that two different bids share, once per pair of bids."""
    holders: dict[tuple[str, str], dict[uuid.UUID, Mark]] = defaultdict(dict)
    for profile in profiles:
        for mark in profile.marks:
            if (key := _key(mark)) is not None:
                # The first mark per bid is enough: a bid repeating its own
                # number is not a link to anyone.
                holders[(mark.kind, key)].setdefault(profile.bid_id, mark)

    links: list[Link] = []
    for (kind, _), by_bid in holders.items():
        bids = sorted(by_bid, key=str)
        for i, bid_a in enumerate(bids):
            for bid_b in bids[i + 1 :]:
                mark_a, mark_b = by_bid[bid_a], by_bid[bid_b]
                links.append(Link(bid_a, bid_b, kind, mark_a.label, mark_a.where, mark_b.where))
    return links


def groups(links: list[Link]) -> list[set[uuid.UUID]]:
    """Bids linked directly or through other bids (union-find)."""
    parent: dict[uuid.UUID, uuid.UUID] = {}

    def root(bid: uuid.UUID) -> uuid.UUID:
        parent.setdefault(bid, bid)
        while parent[bid] != bid:
            parent[bid] = parent[parent[bid]]
            bid = parent[bid]
        return bid

    for link in links:
        parent[root(link.bid_a)] = root(link.bid_b)
    members: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    for bid in parent:
        members[root(bid)].add(bid)
    return list(members.values())


# kind of mark: (flag code, severity, headline). Identifiers share one signal.
_SIGNALS: dict[str, tuple[str, Severity, str]] = {
    "bidder": (
        "same_bidder_in_two_bids",
        Severity.CRITICAL,
        "A bidder in this bid is also in another bid on this tender",
    ),
    "document": (
        "identical_document_in_two_bids",
        Severity.HIGH,
        "A file in this bid is byte-for-byte identical to one in another bid on this tender",
    ),
    "address": (
        "shared_registered_address",
        Severity.HIGH,
        "This bid's registered address is also another bidder's on this tender",
    ),
    "identifier": (
        "shared_identifier_across_bids",
        Severity.HIGH,
        "A registration or certificate number in this bid also appears in another bid on "
        "this tender",
    ),
}

_CAVEAT = "A reason to look, not proof of collusion."


def _signal(kind: str) -> tuple[str, Severity, str]:
    return _SIGNALS.get(kind, _SIGNALS["identifier"])


def _describe(kind: str, label: str, mine: str, others: list[tuple[str, str]]) -> str:
    """One shared mark from one bid's side; ``others`` is (name, where) per other bid."""
    if kind == "bidder":
        return f"{label} is also a member of " + ", ".join(f"{name}'s bid" for name, _ in others)
    theirs = ", ".join(f"{where} in {name}'s bid" for name, where in others)
    if kind == "document":
        return f"{mine} here is the same file as {theirs}"
    noun = "address" if kind == "address" else IDENTIFIER_FIELDS[kind]
    return f"{noun} {label} ({mine} here; {theirs})"


def flags(profiles: list[BidProfile]) -> dict[uuid.UUID, list[RiskFlag]]:
    """The collusion flags for each bid: one per kind of signal, plus its group."""
    names = {p.bid_id: p.name for p in profiles}
    links = find_links(profiles)

    # Per bid and signal, each shared mark once, with every other bid holding it.
    shared: dict[uuid.UUID, dict[str, dict[tuple[str, str, str], list]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )
    for link in links:
        code = _signal(link.kind)[0]
        for here, there, mine, theirs in (
            (link.bid_a, link.bid_b, link.where_a, link.where_b),
            (link.bid_b, link.bid_a, link.where_b, link.where_a),
        ):
            shared[here][code][(link.kind, link.label, mine)].append((there, theirs))

    meta = {code: (severity, headline) for code, severity, headline in _SIGNALS.values()}
    out: dict[uuid.UUID, list[RiskFlag]] = defaultdict(list)
    for bid_id, by_code in shared.items():
        for code, marks in by_code.items():
            severity, headline = meta[code]
            parts = [
                _describe(kind, label, mine, [(names[there], where) for there, where in others])
                for (kind, label, mine), others in marks.items()
            ]
            linked = sorted({str(there) for others in marks.values() for there, _ in others})
            out[bid_id].append(
                RiskFlag(
                    code=code,
                    category=CATEGORY,
                    severity=severity,
                    description=f"{headline}: {'; '.join(parts)}. {_CAVEAT}",
                    evidence_refs={"linked_bids": linked},
                )
            )

    for group in groups(links):
        if len(group) < 3:
            continue
        for bid_id in group:
            others = sorted(names[b] for b in group if b != bid_id)
            out[bid_id].append(
                RiskFlag(
                    code="linked_bidder_group",
                    category=CATEGORY,
                    # Context, not a further signal: the links above already count.
                    severity=Severity.INFO,
                    description=(
                        f"Linked, directly or through other bids, to {len(others)} other "
                        f"bidders on this tender: {', '.join(others)}. {_CAVEAT}"
                    ),
                    evidence_refs={"group": sorted(str(b) for b in group if b != bid_id)},
                )
            )
    return dict(out)
