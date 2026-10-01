"""Reading words off pages that have no text layer, with PaddleOCR.

A scanned certificate or a photographed page has no text layer, so there is
nothing for the locator to find a quoted span in, and every field on it falls
back to opening the page (CLAUDE.md §24). This module reads the words off the
page image instead, with their positions, so those fields can be highlighted
too. The locator records them as ``ocr`` rather than ``exact``: the words were
recognised from an image, not read from the file.

Optional. PaddleOCR and PaddlePaddle are a separate install
(``pip install -e '.[ocr]'``): they are large, and PaddlePaddle publishes wheels
only for some Python versions. Without them a scanned page yields no words, the
same as before this module existed. Written against PaddleOCR 3.x.

PaddleOCR reads lines, not words. Each line is split into words, each placed
along the line in proportion to its characters. That is approximate, but close
enough for a highlight, and it lets the locator match a span that is only part
of a line, exactly as it does on a native text layer.
"""

from __future__ import annotations

import functools
import logging
import re
from pathlib import Path

import pymupdf

log = logging.getLogger(__name__)

# Resolution a page is rendered at for recognition. 200 DPI reads typed
# certificates reliably without making each page slow.
OCR_DPI = 200
# A line recognised with less confidence is left out, rather than offered to the
# locator as text the page may not contain.
MIN_CONFIDENCE = 0.5

_WORD = re.compile(r"\S+")

# (x0, y0, x1, y1, word, block, line, word_no): the shape of pymupdf's
# get_text("words"), so a recognised page is read exactly like a native one.
Word = tuple[float, float, float, float, str, int, int, int]
# (text, confidence, x0, y0, x1, y1), in pixels of the rendered image.
Line = tuple[str, float, float, float, float, float]


@functools.cache
def _engine():
    """The PaddleOCR engine, loaded on first use, or None if it is not installed."""
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        log.info("PaddleOCR is not installed; pages without a text layer will not be read")
        return None
    logging.getLogger("ppocr").setLevel(logging.WARNING)
    return PaddleOCR(
        lang="en",
        # Certificates are uploaded flat and upright; the page-level orientation
        # and unwarping models would add time for nothing.
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=True,
    )


def _image(page: pymupdf.Page):
    """The page as an H×W×3 BGR array, the layout PaddleOCR expects."""
    import numpy as np  # installed with PaddleOCR

    pix = page.get_pixmap(dpi=OCR_DPI, colorspace=pymupdf.csRGB, alpha=False)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    return rgb[:, :, ::-1]


def _bounds(polygon) -> tuple[float, float, float, float]:
    xs = [float(point[0]) for point in polygon]
    ys = [float(point[1]) for point in polygon]
    return min(xs), min(ys), max(xs), max(ys)


def _lines(engine, image) -> list[Line]:
    """Every line PaddleOCR recognised, with its confidence and box."""
    lines: list[Line] = []
    for result in engine.predict(image):
        boxes = (
            result["rec_boxes"]
            if "rec_boxes" in result
            else [_bounds(polygon) for polygon in result["rec_polys"]]
        )
        for text, score, box in zip(result["rec_texts"], result["rec_scores"], boxes, strict=True):
            x0, y0, x1, y1 = (float(v) for v in box)
            lines.append((str(text), float(score), x0, y0, x1, y1))
    return lines


def _words(lines: list[Line], scale: float) -> list[Word]:
    """Split confident lines into words, placed in proportion to their characters."""
    words: list[Word] = []
    for line_no, (text, confidence, x0, y0, x1, y1) in enumerate(lines):
        if confidence < MIN_CONFIDENCE or not text.strip():
            continue
        per_char = (x1 - x0) / len(text)
        for word_no, match in enumerate(_WORD.finditer(text)):
            words.append(
                (
                    (x0 + per_char * match.start()) * scale,
                    y0 * scale,
                    (x0 + per_char * match.end()) * scale,
                    y1 * scale,
                    match.group(),
                    line_no,
                    0,
                    word_no,
                )
            )
    return words


@functools.lru_cache(maxsize=256)
def words_for(path: str, number: int) -> tuple[Word, ...]:
    """The words recognised on one page, in PDF points.

    Cached by file and page: storage is hash-addressed, so a path always holds
    the same bytes, and a page is recognised once however often it is read.
    Never raises. A page OCR cannot read is a page with no words, and an upload
    must never fail over it (§19).
    """
    engine = _engine()
    if engine is None:
        return ()
    try:
        with pymupdf.open(path) as doc:
            image = _image(doc[number - 1])
        return tuple(_words(_lines(engine, image), scale=72 / OCR_DPI))
    except Exception as exc:  # noqa: BLE001 - see docstring
        log.warning("OCR failed on page %d of %s: %s", number, Path(path).name, exc)
        return ()


def text_of(words: tuple[Word, ...] | list[Word]) -> str:
    """The recognised words as text, one line per recognised line."""
    lines: dict[int, list[str]] = {}
    for word in words:
        lines.setdefault(word[5], []).append(word[4])
    return "\n".join(" ".join(line) for line in lines.values())
