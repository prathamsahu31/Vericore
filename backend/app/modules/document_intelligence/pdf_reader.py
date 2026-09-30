"""Reads a PDF's text layer along with the geometry of every word.

This is where coordinates come from. The language model never supplies them
(CLAUDE.md §24) — it quotes a span, and the span is found among these words.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pymupdf
import pytesseract
from PIL import Image



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

    @property
    def has_text_layer(self) -> bool:
        """False for a scan or a photograph — nothing to search for a span in."""
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
    """Extract text and word geometry from every page, with OCR fallback."""
    from app.storage import ensure_local_copy

    path = ensure_local_copy(path)
    path = Path(path)
    pages: list[PdfPage] = []
    with pymupdf.open(path) as doc:
        for index, page in enumerate(doc, start=1):
            raw = page.get_text("words")  # (x0, y0, x1, y1, word, block, line, word_no)
            extracted_text = page.get_text("text")
            
            # --- START OCR FALLBACK ---
            if not raw:
                # Page has no native text. Render to image at 150 DPI for OCR
                pix = page.get_pixmap(dpi=150)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                
                # Get word-level bounding boxes and text from Tesseract
                ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                
                ocr_words = []
                ocr_text = []
                
                # Tesseract returns coordinates in pixels (at 150 DPI). 
                # We must scale them back to PDF points (72 DPI) for the UI highlighter.
                scale = 72.0 / 150.0
                
                for i in range(len(ocr_data['text'])):
                    word_text = str(ocr_data['text'][i]).strip()
                    if word_text:
                        x0 = float(ocr_data['left'][i]) * scale
                        y0 = float(ocr_data['top'][i]) * scale
                        w = float(ocr_data['width'][i]) * scale
                        h = float(ocr_data['height'][i]) * scale
                        
                        ocr_words.append(
                            WordBox(
                                page=index,
                                x0=x0,
                                y0=y0,
                                x1=x0 + w,
                                y1=y0 + h,
                                text=word_text,
                                block=int(ocr_data['block_num'][i]),
                                line=int(ocr_data['line_num'][i]),
                            )
                        )
                        ocr_text.append(word_text)
                
                words = tuple(ocr_words)
                extracted_text = " ".join(ocr_text)
            else:
                # --- NATIVE PDF EXTRACTION (Original Logic) ---
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
                    if str(w[4]).strip()
                )

            pages.append(
                PdfPage(
                    number=index,
                    width=float(page.rect.width),
                    height=float(page.rect.height),
                    text=extracted_text,
                    words=words,
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
