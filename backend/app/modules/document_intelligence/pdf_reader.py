"""Reads a PDF's text layer along with the geometry of every word.

This is where coordinates come from. The language model never supplies them
(CLAUDE.md §24) — it quotes a span, and the span is found among these words.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pymupdf


@dataclass(frozen=True)
class WordBox:
    """One word and where it sits on the page.

    ``block`` and ``line`` are what group words into lines, which is how a
    wrapped span becomes several rectangles instead of one that swallows the
    text between them.
    """

    page: int
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    block: int
    line: int


@dataclass(frozen=True)
class PdfPage:
    number: int  # 1-based
    width: float
    height: float
    text: str
    words: tuple[WordBox, ...]
    # True when the words were recognised off the page image because the page
    # had no text layer. The locator records a match on them as ``ocr``.
    ocr: bool = False

    @property
    def has_text_layer(self) -> bool:
        """False when there are no words to search: a scan OCR did not read."""
        return bool(self.words)

    @property
    def rect(self) -> tuple[float, float, float, float]:
        """The whole page, used as the fallback box when a span cannot be placed."""
        return (0.0, 0.0, self.width, self.height)


@dataclass(frozen=True)
class PdfDocument:
    path: Path
    pages: tuple[PdfPage, ...]

    @property
    def page_count(self) -> int:
        return len(self.pages)

    def page(self, number: int) -> PdfPage | None:
        for p in self.pages:
            if p.number == number:
                return p
        return None


def read_pdf(path: str | Path) -> PdfDocument:
    """Extract text and word geometry from every page.

    A page with no text layer, a scan or a photograph, is read with OCR when it
    is installed; its words then carry recognised positions (see ``ocr``).
    """
    from app.modules.document_intelligence import ocr
    from app.modules.document_intelligence.bhashini import translate_to_english
    from app.storage import ensure_local_copy

    path = Path(ensure_local_copy(path))
    pages: list[PdfPage] = []
    with pymupdf.open(path) as doc:
        for index, page in enumerate(doc, start=1):
            # (x0, y0, x1, y1, word, block, line, word_no)
            raw = [w for w in page.get_text("words") if str(w[4]).strip()]
            text = page.get_text("text")
            recognised = False
            if not raw:
                raw = list(ocr.words_for(str(path), index))
                text = ocr.text_of(raw)
                recognised = bool(raw)
            words = tuple(
                WordBox(
                    page=index,
                    x0=float(w[0]),
                    y0=float(w[1]),
                    x1=float(w[2]),
                    y1=float(w[3]),
                    text=str(w[4]),
                    block=int(w[5]),
                    line=int(w[6]),
                )
                for w in raw
            )
            pages.append(
                PdfPage(
                    number=index,
                    width=float(page.rect.width),
                    height=float(page.rect.height),
                    # Non-English text is translated; English pages are left as
                    # they are by the heuristic inside translate_to_english.
                    text=translate_to_english(text),
                    words=words,
                    ocr=recognised,
                )
            )
    return PdfDocument(path=path, pages=tuple(pages))


def build_provider_text(
    pages: tuple[PdfPage, ...], page_range: tuple[int, int] | None = None
) -> str:
    """Join pages into one string, marking page boundaries.

    A provider that receives only text still has to report which page a span
    came from, so each page body is preceded by a ``[page N]`` line. Providers
    that read the PDF natively do not need this and are handed the bytes.
    """
    selected = [
        p for p in pages if page_range is None or page_range[0] <= p.number <= page_range[1]
    ]
    return "\n".join(f"[page {p.number}]\n{p.text}" for p in selected)
