"""Unit tests for the evidence locator (CLAUDE.md §24).

No database and no network: the locator is a pure function over word geometry,
and that is precisely why it can be tested exhaustively. It is also the piece
whose silent failure would put a highlight on the wrong part of a page, so each
rung of the ladder gets a passing case, a failing case and a boundary case
(§13).
"""

from __future__ import annotations

import pytest

from app.db.enums import LocatorStatus
from app.modules.document_intelligence.pdf_reader import PdfPage, WordBox
from app.modules.evidence_extraction.locator import (
    FUZZY_THRESHOLD,
    AmbiguousSpan,
    locate,
    normalize,
)


def make_page(lines: list[str], number: int = 1) -> PdfPage:
    """A page whose words sit on predictable 20pt lines, 50pt apart."""
    words: list[WordBox] = []
    for line_no, line in enumerate(lines):
        x = 50.0
        for word in line.split():
            width = len(word) * 6.0
            words.append(
                WordBox(
                    page=number,
                    x0=x,
                    y0=100.0 + line_no * 20,
                    x1=x + width,
                    y1=115.0 + line_no * 20,
                    text=word,
                    block=0,
                    line=line_no,
                )
            )
            x += width + 4
    return PdfPage(
        number=number, width=595.0, height=842.0, text="\n".join(lines), words=tuple(words)
    )


PAGE = make_page(
    [
        "Form GST REG-06 Registration Certificate",
        "Registration Number (GSTIN) : 33AABCA1234C1ZM",
        "Legal Name of Business : ABC Infrastructure Private Limited",
        "Status : Active",
    ]
)


# ── normalize ────────────────────────────────────────────────────────────────
def test_normalize_folds_case_whitespace_and_dashes():
    assert normalize("  ABC—Infra   Pvt  Ltd ") == "abc-infra pvt ltd"


def test_normalize_leaves_identifiers_comparable():
    assert normalize("33AABCA1234C1ZM") == "33aabca1234c1zm"


# ── exact ────────────────────────────────────────────────────────────────────
def test_exact_match_returns_the_words_own_box():
    box = locate("Status : Active", [PAGE], cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.EXACT
    assert box.page == 1
    assert box.y0 == 160.0  # the fourth line, not the heading
    assert box.is_located


def test_single_token_span_is_found_inside_a_longer_word():
    """A span may arrive glued to punctuation, e.g. ``(GSTIN)``."""
    box = locate("33AABCA1234C1ZM", [PAGE], cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.EXACT
    assert box.y0 == 120.0


# ── normalized ───────────────────────────────────────────────────────────────
def test_case_and_spacing_differences_still_match():
    box = locate("status  :  active", [PAGE], cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.NORMALIZED
    assert box.y0 == 160.0


# ── fuzzy ────────────────────────────────────────────────────────────────────
def test_close_but_inexact_span_matches_fuzzily_and_records_its_score():
    box = locate(
        "Legal Name of Business : ABC Infrastructure Pvt Limited",
        [PAGE],
        cited_page=1,
        segment_first_page=1,
    )
    assert box.status is LocatorStatus.FUZZY
    assert box.score is not None and box.score >= FUZZY_THRESHOLD
    assert box.y0 == 140.0


def test_a_span_below_the_threshold_is_not_guessed_at():
    """The boundary case: too different is not located at all."""
    box = locate(
        "Completely unrelated text about something else entirely",
        [PAGE],
        cited_page=1,
        segment_first_page=1,
    )
    assert box.status is LocatorStatus.PAGE_FALLBACK
    assert not box.is_located


# ── ambiguity ────────────────────────────────────────────────────────────────
def test_a_span_occurring_twice_falls_back_to_the_page():
    """§24: a wrong highlight is worse than no highlight.

    "Small" appears both in the heading and as the value. Picking the first
    would point the officer at the heading, silently.
    """
    page = make_page(
        [
            "Ministry of Micro, Small and Medium Enterprises",
            "Type of Enterprise : Small",
        ]
    )
    box = locate("Small", [page], cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.PAGE_FALLBACK
    assert not box.is_located


def test_the_same_value_quoted_with_its_label_is_unambiguous():
    """The fix for the case above is a longer span, not a cleverer search."""
    page = make_page(
        [
            "Ministry of Micro, Small and Medium Enterprises",
            "Type of Enterprise : Small",
        ]
    )
    box = locate("Type of Enterprise : Small", [page], cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.EXACT
    assert box.y0 == 120.0


def test_find_run_raises_rather_than_choosing():
    from app.modules.evidence_extraction.locator import _find_run

    with pytest.raises(AmbiguousSpan):
        _find_run(["a"], ["a", "b", "a"])


# ── wrapped spans ────────────────────────────────────────────────────────────
def test_a_span_across_lines_yields_one_rectangle_per_line():
    page = make_page(["Description of Work : Supply and", "installation of piping"])
    box = locate(
        "Description of Work : Supply and installation of piping",
        [page],
        cited_page=1,
        segment_first_page=1,
    )
    assert box.status is LocatorStatus.EXACT
    assert box.rects is not None
    assert len(box.rects) == 2
    # The union spans both lines; the rectangles do not.
    assert box.y0 == 100.0 and box.y1 == 135.0


def test_a_span_on_one_line_has_no_separate_rectangles():
    box = locate("Status : Active", [PAGE], cited_page=1, segment_first_page=1)
    assert box.rects is None


# ── page selection and fallbacks ─────────────────────────────────────────────
def test_the_cited_page_is_searched_but_a_wrong_hint_is_survivable():
    """An off-by-one page hint should not cost a highlight."""
    page_one = make_page(["Nothing of interest here"], number=1)
    page_two = make_page(["Status : Active"], number=2)
    box = locate("Status : Active", [page_one, page_two], cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.EXACT
    assert box.page == 2  # the page it was actually found on


def test_page_fallback_covers_the_whole_cited_page():
    box = locate("not present anywhere", [PAGE], cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.PAGE_FALLBACK
    assert (box.x0, box.y0, box.x1, box.y1) == (0.0, 0.0, 595.0, 842.0)


def test_segment_fallback_when_the_cited_page_is_not_in_the_segment():
    box = locate("anything", [PAGE], cited_page=99, segment_first_page=1)
    assert box.status is LocatorStatus.SEGMENT_FALLBACK
    assert box.page == 1


def test_a_page_with_no_text_layer_falls_back_rather_than_failing():
    """A scan has no words to search. It must still produce a box."""
    scan = PdfPage(number=1, width=595.0, height=842.0, text="", words=())
    box = locate("Status : Active", [scan], cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.PAGE_FALLBACK
    assert box.x1 == 595.0


def test_an_empty_span_is_never_located():
    box = locate("   ", [PAGE], cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.PAGE_FALLBACK
