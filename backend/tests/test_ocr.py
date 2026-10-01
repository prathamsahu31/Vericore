"""Tests for reading pages with no text layer.

PaddleOCR itself is an optional install and is not needed here: a fake engine
returns results in the shape PaddleOCR 3.x's ``predict`` does, so what this
project builds on top of it is tested: parsing, splitting lines into placed
words, reading a scanned page, and locating a span on it as ``ocr``.
"""

from __future__ import annotations

import pymupdf
import pytest

from app.db.enums import LocatorStatus
from app.modules.document_intelligence import ocr
from app.modules.document_intelligence.pdf_reader import read_pdf
from app.modules.evidence_extraction.locator import locate

# One recognised line at 200 DPI: 400 px wide, so 20 px per character.
LINE = "GSTIN 33AABCA1234C1ZM"
RESULT = {
    "rec_texts": [LINE, "smudge"],
    "rec_scores": [0.98, 0.31],
    "rec_boxes": [[100, 200, 100 + 20 * len(LINE), 240], [0, 0, 50, 10]],
}


class _FakeEngine:
    def __init__(self, results=None, error: Exception | None = None) -> None:
        self.results = [RESULT] if results is None else results
        self.error = error

    def predict(self, image):
        if self.error:
            raise self.error
        return self.results


@pytest.fixture(autouse=True)
def _fresh_cache():
    ocr.words_for.cache_clear()
    yield
    ocr.words_for.cache_clear()


@pytest.fixture
def engine(monkeypatch):
    """Install a fake engine, and skip rendering, which would need numpy."""
    fake = _FakeEngine()
    monkeypatch.setattr(ocr, "_engine", lambda: fake)
    monkeypatch.setattr(ocr, "_image", lambda page: "image")
    return fake


@pytest.fixture
def scan(tmp_path):
    """A one-page PDF with a drawing and no text layer, as a scan would be."""
    doc = pymupdf.open()
    doc.new_page().draw_rect(pymupdf.Rect(50, 50, 200, 200))
    path = tmp_path / "scan.pdf"
    doc.save(path)
    return path


def test_a_line_is_split_into_words_placed_along_it():
    words = ocr._words([(LINE, 0.98, 100, 200, 520, 240)], scale=0.5)
    assert [w[4] for w in words] == ["GSTIN", "33AABCA1234C1ZM"]
    # "GSTIN" is characters 0-5 of 21 across 420 px: x 100-200 px, halved to points.
    assert words[0][:4] == (50.0, 100.0, 100.0, 120.0)
    assert words[1][:4] == (110.0, 100.0, 260.0, 120.0)
    assert {w[5] for w in words} == {0}  # one line, so one block


def test_lines_below_the_confidence_floor_are_dropped():
    floor = ocr.MIN_CONFIDENCE
    words = ocr._words(
        [("kept", floor, 0, 0, 40, 10), ("dropped", floor - 0.01, 0, 20, 70, 30)], scale=1
    )
    assert [w[4] for w in words] == ["kept"]


def test_boxes_come_from_polygons_when_there_are_no_rectangles():
    result = {
        "rec_texts": ["PAN"],
        "rec_scores": [0.9],
        "rec_polys": [[(10, 20), (70, 22), (70, 40), (10, 38)]],
    }
    assert ocr._lines(_FakeEngine([result]), "image") == [("PAN", 0.9, 10, 20, 70, 40)]


def test_without_paddleocr_a_scan_yields_no_words(monkeypatch, scan):
    monkeypatch.setattr(ocr, "_engine", lambda: None)
    page = read_pdf(scan).pages[0]
    assert page.words == ()
    assert page.ocr is False


def test_an_ocr_failure_never_fails_the_read(engine, scan):
    engine.error = RuntimeError("model crashed")
    page = read_pdf(scan).pages[0]
    assert page.words == ()
    assert page.ocr is False


def test_a_scanned_page_is_read_with_ocr(engine, scan):
    page = read_pdf(scan).pages[0]

    assert page.ocr is True
    assert page.text == LINE
    assert [w.text for w in page.words] == ["GSTIN", "33AABCA1234C1ZM"]
    # 200 DPI pixels to 72 DPI points.
    assert page.words[0].x0 == pytest.approx(100 * 72 / 200)


def test_a_span_on_a_scanned_page_is_located_as_ocr(engine, scan):
    pages = list(read_pdf(scan).pages)
    box = locate("33AABCA1234C1ZM", pages, cited_page=1, segment_first_page=1)
    assert box.status is LocatorStatus.OCR
    assert box.is_located


def test_a_page_with_a_text_layer_never_goes_to_ocr(engine, tmp_path):
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "GSTIN 07ABCDE1234F1Z5")
    path = tmp_path / "typed.pdf"
    doc.save(path)

    engine.error = AssertionError("OCR must not run on a page that has text")
    page = read_pdf(path).pages[0]
    assert page.ocr is False
    assert locate("07ABCDE1234F1Z5", [page], 1, 1).status is LocatorStatus.EXACT
