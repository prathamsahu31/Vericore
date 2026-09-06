"""Tests for ChunkingProvider.

The failure it exists for: a ~90-page NIT (~60k tokens) is refused whole by an
account whose tokens-per-minute cap is 30k ("Request too large ... on tokens
per min (TPM)"). The document must be sent in page-aligned chunks and the
results merged without losing or duplicating rows.
"""

from __future__ import annotations

from app.llm.providers.decorators import ChunkingProvider, _group_pages, _page_spans
from app.llm.providers.stub import StubProvider
from app.llm.types import DocumentInput

BIG_TOKEN_BUDGET = 10_000_000  # keeps _wait_tokens from ever sleeping in tests


def _nit_pages(count: int) -> str:
    """A multi-page NIT with one PQ-table clause per page."""
    pages = []
    for page in range(1, count + 1):
        pages.append(
            f"[page {page}]\n"
            f"{page}.{page} Clause Title Number {page}\n"
            f"Detail paragraph for clause {page}.\n"
        )
    return "\n".join(pages)


def test_page_spans_are_aligned_to_page_markers():
    text = "[page 1]\nfirst\n[page 2]\nsecond\n[page 3]\nthird\n"
    assert [(n, s, e) for n, s, e in _page_spans(text)] == [
        (1, 0, text.index("[page 2]")),
        (2, text.index("[page 2]"), text.index("[page 3]")),
        (3, text.index("[page 3]"), len(text)),
    ]


def test_pages_are_grouped_under_the_token_budget():
    text = _nit_pages(4)
    one_page = _nit_pages(1)
    max_tokens = len(one_page) // 4 * 2  # roughly two pages per chunk
    groups = _group_pages(text, _page_spans(text), max_tokens)
    # Every chunk starts at a page marker: a chunk boundary is never mid-page.
    for first, last, chunk in groups:
        assert chunk.startswith(f"[page {first}]")
        assert 1 <= first <= last <= 4
        assert (len(chunk) // 4) <= max_tokens or first == last


def test_small_document_is_passed_through_whole(count=0):
    from app.llm.providers.decorators import _estimate_tokens

    calls = {"n": 0}

    class Counting(StubProvider):
        def extract_requirements(self, doc):
            calls["n"] += 1
            return super().extract_requirements(doc)

    text = _nit_pages(2)
    provider = ChunkingProvider(
        Counting(),
        max_request_tokens=_estimate_tokens(text),
        tokens_per_minute=BIG_TOKEN_BUDGET,
    )
    result = provider.extract_requirements(DocumentInput(text=text))
    assert calls["n"] == 1
    assert [r.code for r in result.requirements] == ["REQ-001", "REQ-002"]


def test_oversized_document_is_sent_as_multiple_chunks(count=0):
    calls: list[tuple[int, int]] = []

    class Recording(StubProvider):
        def extract_requirements(self, doc):
            calls.append(doc.page_range)
            return super().extract_requirements(doc)

    text = _nit_pages(4)
    one_page = _nit_pages(1)
    provider = ChunkingProvider(
        Recording(),
        max_request_tokens=len(one_page) // 4,
        tokens_per_minute=BIG_TOKEN_BUDGET,
    )
    result = provider.extract_requirements(DocumentInput(text=text))

    assert len(calls) == 4
    assert calls == [(1, 1), (2, 2), (3, 3), (4, 4)]

    # Codes are renumbered across chunks and every clause survived.
    assert [r.code for r in result.requirements] == [
        "REQ-001",
        "REQ-002",
        "REQ-003",
        "REQ-004",
    ]
    assert [r.source_page for r in result.requirements] == [1, 2, 3, 4]


def test_duplicate_requirements_across_chunks_are_dropped():
    text = "[page 1]\n1.1 Shared Clause Title\nDetail for clause.\n" "[page 2]\n2.2 Shared Clause Title\nDetail for clause.\n"
    one_page = "[page 1]\n1.1 Shared Clause Title\nDetail for clause.\n"
    provider = ChunkingProvider(
        StubProvider(),
        max_request_tokens=len(one_page) // 4,
        tokens_per_minute=BIG_TOKEN_BUDGET,
    )
    result = provider.extract_requirements(DocumentInput(text=text))
    assert len(result.requirements) == 1
    assert result.requirements[0].code == "REQ-001"
    assert result.requirements[0].source_page == 1


def test_merged_result_keeps_provenance():
    text = "[page 1]\n1.1 Clause Title Number 1\nDetail for clause one.\n" "[page 2]\n2.2 Clause Title Number 2\nDetail for clause two.\n"
    one_page = "[page 1]\n1.1 Clause Title Number 1\nDetail for clause one.\n"
    provider = ChunkingProvider(
        StubProvider(),
        max_request_tokens=len(one_page) // 4,
        tokens_per_minute=BIG_TOKEN_BUDGET,
    )
    result = provider.extract_requirements(DocumentInput(text=text))
    assert result.provenance is not None
    assert result.provenance.provider == "stub"