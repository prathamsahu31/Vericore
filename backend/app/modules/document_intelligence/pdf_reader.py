"""Reads a PDF's text layer along with the geometry of every word.

This is where coordinates come from. The language model never supplies them
(CLAUDE.md §24) — it quotes a span, and the span is found among these words.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pymupdf
from PIL import Image
import numpy as np
import logging

logging.getLogger("ppocr").setLevel(logging.WARNING)

try:
    from paddleocr import PaddleOCR
    _ocr_model = PaddleOCR(use_textline_orientation=True, lang='en')
except ImportError:
    _ocr_model = None



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
                
                ocr_words = []
                ocr_text = []
                
                if _ocr_model:
                    # Convert PIL image to NumPy array for PaddleOCR
                    img_np = np.array(img)
                    result = _ocr_model.ocr(img_np, cls=True)
                    
                    scale = 72.0 / 150.0
                    lines = result[0] if result and result[0] else []
                    
                    for line_idx, line in enumerate(lines):
                        box, (text, confidence) = line
                        word_text = text.strip()
                        
                        if word_text:
                            x_coords = [point[0] for point in box]
                            y_coords = [point[1] for point in box]
                            
                            x0 = min(x_coords) * scale
                            y0 = min(y_coords) * scale
                            x1 = max(x_coords) * scale
                            y1 = max(y_coords) * scale
                            
                            ocr_words.append(
                                WordBox(
                                    page=index,
                                    x0=x0,
                                    y0=y0,
                                    x1=x1,
                                    y1=y1,
                                    text=word_text,
                                    block=line_idx,
                                    line=0,
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

            from app.modules.document_intelligence.bhashini import translate_to_english
            translated_text = translate_to_english(extracted_text)

            pages.append(
                PdfPage(
                    number=index,
                    width=float(page.rect.width),
                    height=float(page.rect.height),
                    text=translated_text,
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
