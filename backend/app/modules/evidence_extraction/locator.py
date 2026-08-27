"""Recovers page coordinates for a value the model only quoted as text.

CLAUDE.md §24. The model quotes a verbatim span; this module finds that span
among the page's own words and takes the geometry from there. Locating is a
string search, not a judgement, which is why it is allowed to be deterministic
code rather than another model call.

The ladder, cheapest rung first:

    exact -> normalized -> fuzzy -> page_fallback -> segment_fallback

The two fallback rungs mean "not located". They still produce a box — the page
rectangle — because a citation that opens nothing is worse than one that opens
the right page without a highlight. What they must never do is produce an
automatic COMPLIANT; that rule lives in the compliance engine (§21).
"""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass

from rapidfuzz import fuzz

from app.db.enums import LocatorStatus
from app.modules.document_intelligence.pdf_reader import PdfPage, WordBox

log = logging.getLogger(__name__)

# Below this, a fuzzy match is not trusted and the field falls back to the page.
FUZZY_THRESHOLD = 0.85

# Characters that differ between what a PDF prints and what a model transcribes.
_DASHES = dict.fromkeys(map(ord, "‐‑‒–—―−"), "-")
_QUOTES = dict.fromkeys(map(ord, "‘’‛′"), "'")
_DQUOTES = dict.fromkeys(map(ord, "“”‟″"), '"')
_TRANSLATIONS = {**_DASHES, **_QUOTES, **_DQUOTES, 0x00A0: " "}

_WS = re.compile(r"\s+")


@dataclass(frozen=True)
class LocatedBox:
    """Where a value sits, and how confident we are that it sits there."""

    page: int
    x0: float
    y0: float
    x1: float
    y1: float
    status: LocatorStatus
    score: float | None = None
    # Per-line rectangles when the span wraps. None when it fits on one line.
    rects: tuple[dict[str, float], ...] | None = None

    @property
    def is_located(self) -> bool:
        """False when the box is a page rather than a highlight."""
        return self.status not in (
            LocatorStatus.PAGE_FALLBACK,
            LocatorStatus.SEGMENT_FALLBACK,
        )


def normalize(text: str) -> str:
    """Fold away the differences that don't change what a value *is*."""
    text = unicodedata.normalize("NFKC", text).translate(_TRANSLATIONS)
    return _WS.sub(" ", text).strip().casefold()


def _tokens(text: str) -> list[str]:
    return text.split()


class AmbiguousSpan(Exception):
    """The span occurs more than once on the page, so no occurrence is *the* one.

    Raised rather than resolved. §24: an approximate span points a procurement
    officer at the wrong part of the page, which is worse than no span at all —
    and picking the first of several matches is exactly that, silently.
    """


def _find_run(needle: list[str], haystack: list[str]) -> tuple[int, int] | None:
    """The contiguous run of ``haystack`` equal to ``needle``.

    Raises ``AmbiguousSpan`` if there is more than one.
    """
    if not needle or len(needle) > len(haystack):
        return None
    first = needle[0]
    span = len(needle)
    hits = [
        (i, i + span - 1)
        for i in range(len(haystack) - span + 1)
        if haystack[i] == first and haystack[i : i + span] == needle
    ]
    if len(hits) > 1:
        raise AmbiguousSpan(" ".join(needle))
    return hits[0] if hits else None


def _find_within_word(needle: str, haystack: list[str]) -> tuple[int, int] | None:
    """A single-token span may be glued to its label, e.g. ``GSTIN:27ABCDE...``."""
    if not needle:
        return None
    hits = [(i, i) for i, word in enumerate(haystack) if needle in word]
    if len(hits) > 1:
        raise AmbiguousSpan(needle)
    return hits[0] if hits else None


def _find_fuzzy(needle: list[str], haystack: list[str]) -> tuple[tuple[int, int], float] | None:
    """Best-scoring window of roughly the right length."""
    if not needle or not haystack:
        return None
    target = " ".join(needle)
    best: tuple[tuple[int, int], float] | None = None
    for width in {max(1, len(needle) - 1), len(needle), len(needle) + 1}:
        if width > len(haystack):
            continue
        for i in range(len(haystack) - width + 1):
            window = " ".join(haystack[i : i + width])
            score = fuzz.ratio(target, window) / 100.0
            if best is None or score > best[1]:
                best = ((i, i + width - 1), score)
    return best


def _box_for(
    words: list[WordBox], start: int, end: int, status: LocatorStatus, score: float | None
) -> LocatedBox:
    """Union rectangle, plus one rectangle per line the span touches."""
    matched = words[start : end + 1]
    by_line: dict[tuple[int, int], list[WordBox]] = {}
    for w in matched:
        by_line.setdefault((w.block, w.line), []).append(w)

    rects = tuple(
        {
            "page": line[0].page,
            "x0": min(w.x0 for w in line),
            "y0": min(w.y0 for w in line),
            "x1": max(w.x1 for w in line),
            "y1": max(w.y1 for w in line),
        }
        for line in by_line.values()
    )
    return LocatedBox(
        page=matched[0].page,
        x0=min(w.x0 for w in matched),
        y0=min(w.y0 for w in matched),
        x1=max(w.x1 for w in matched),
        y1=max(w.y1 for w in matched),
        status=status,
        score=score,
        rects=rects if len(rects) > 1 else None,
    )


def _locate_on_page(span: str, page: PdfPage) -> LocatedBox | None:
    """Where the span sits on this page, or None if it isn't unambiguously here."""
    words = list(page.words)
    if not words:
        return None

    raw = [w.text for w in words]
    span_raw = _tokens(span.strip())

    hit = _find_run(span_raw, raw)
    if hit is None and len(span_raw) == 1:
        hit = _find_within_word(span_raw[0], raw)
    if hit is not None:
        return _box_for(words, *hit, LocatorStatus.EXACT, None)

    norm = [normalize(w.text) for w in words]
    span_norm = _tokens(normalize(span))

    hit = _find_run(span_norm, norm)
    if hit is None and len(span_norm) == 1:
        hit = _find_within_word(span_norm[0], norm)
    if hit is not None:
        return _box_for(words, *hit, LocatorStatus.NORMALIZED, None)

    best = _find_fuzzy(span_norm, norm)
    if best is not None and best[1] >= FUZZY_THRESHOLD:
        (start, end), score = best
        return _box_for(words, start, end, LocatorStatus.FUZZY, round(score, 4))

    return None


def locate(
    span: str,
    pages: list[PdfPage],
    cited_page: int | None,
    segment_first_page: int,
) -> LocatedBox:
    """Find ``span`` among ``pages``, degrading to a page rectangle if it isn't there.

    The cited page is searched first, then the rest of the segment — a page hint
    that is off by one should not cost a highlight. Whichever page the span is
    actually found on is the page recorded.
    """
    by_number = {p.number: p for p in pages}
    order: list[int] = []
    if cited_page in by_number:
        order.append(cited_page)  # type: ignore[arg-type]
    order += [p.number for p in pages if p.number != cited_page]

    if span and span.strip():
        for number in order:
            try:
                found = _locate_on_page(span, by_number[number])
            except AmbiguousSpan as exc:
                # Found, but in more than one place. Degrade to the page rather
                # than highlight a guess.
                log.info(
                    "ambiguous span on page %d, falling back to the page: %s",
                    number,
                    exc,
                )
                break
            if found is not None:
                return found

    # Not found. Fall back to a whole page — never to NULL, never to dropping
    # the field.
    fallback_page = by_number.get(cited_page) if cited_page else None
    if fallback_page is not None:
        x0, y0, x1, y1 = fallback_page.rect
        return LocatedBox(fallback_page.number, x0, y0, x1, y1, LocatorStatus.PAGE_FALLBACK)

    anchor = by_number.get(segment_first_page) or (pages[0] if pages else None)
    if anchor is None:
        # No geometry at all. A unit box on page 1 keeps the NOT NULL contract
        # while making it obvious the position is unknown.
        return LocatedBox(segment_first_page, 0.0, 0.0, 0.0, 0.0, LocatorStatus.SEGMENT_FALLBACK)
    x0, y0, x1, y1 = anchor.rect
    return LocatedBox(anchor.number, x0, y0, x1, y1, LocatorStatus.SEGMENT_FALLBACK)
