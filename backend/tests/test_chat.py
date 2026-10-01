"""Tests for the chat widget route: its context, and its cost limits.

What the assistant is told depends on the page the officer is on, so the context
sent for each kind of page is captured and checked. The chat runs on a paid
provider in a live setup, so the limits that bound what one question can cost
are tested too: the cheap model, the output cap, the input cap, and the cache.
No test makes a network call (CLAUDE.md §7.7); the OpenAI request is captured
before it would leave the process.
"""

from __future__ import annotations

import io
import json
from pathlib import Path

import pymupdf
import pytest
from sqlalchemy import text

from app.api.chat import (
    MAX_CONTEXT_CHARS,
    MAX_QUESTION_CHARS,
    MAX_RECORD_CHARS,
    TRUNCATED_MARKER,
    UNREADABLE,
    build_context,
)
from app.api.deps import extraction_provider
from app.llm.base import LLMError
from app.llm.config import CHAT_MAX_OUTPUT_TOKENS
from app.llm.providers import openai_provider
from app.llm.providers.decorators import CachedProvider
from app.llm.providers.openai_provider import OpenAIProvider
from app.llm.providers.stub import StubProvider
from app.llm.types import ChatAnswer, DocumentInput, LLMRole

SEED = Path(__file__).resolve().parents[2] / "seed" / "bidders" / "bidder_a"

STRUCTURED_ANSWER = {
    "summary": "The GSTIN is 33AABCA1234C1ZM.",
    "sections": [
        {
            "heading": "Identity and registration",
            "points": [
                {
                    "text": "GSTIN 33AABCA1234C1ZM, active.",
                    "sources": [{"document": "gst.pdf", "page": 1}],
                }
            ],
        }
    ],
    "injection_suspected": False,
}


def test_general_question_is_answered_by_the_active_provider(client):
    response = client.post("/chat", json={"question": "What does Vericore check?"})
    assert response.status_code == 200
    assert response.json() == {
        "summary": "StubProvider does not generate chat answers.",
        "sections": [],
        "injection_suspected": False,
        "notices": [],
        "links": [],
    }


def test_overlong_question_is_rejected_before_any_llm_call(client):
    response = client.post("/chat", json={"question": "x" * (MAX_QUESTION_CHARS + 1)})
    assert response.status_code == 422


def test_question_at_the_length_limit_is_accepted(client):
    response = client.post("/chat", json={"question": "x" * MAX_QUESTION_CHARS})
    assert response.status_code == 200


class _CapturingChat(StubProvider):
    """Records the context a question was sent with, instead of answering it.

    A stub otherwise, because uploading a document uses the same provider.
    """

    context: str | None = None

    def generate_chat(self, question: str, doc: DocumentInput, *, role: LLMRole) -> ChatAnswer:
        self.context = doc.text
        return ChatAnswer(summary="captured")


@pytest.fixture
def captured(client) -> _CapturingChat:
    fake = _CapturingChat()
    client.app.dependency_overrides[extraction_provider] = lambda: fake
    return fake


def _blank_pdf() -> bytes:
    """A page with a drawing and no text layer, as a scan would have."""
    doc = pymupdf.open()
    doc.new_page().draw_rect(pymupdf.Rect(50, 50, 200, 200))
    return doc.tobytes()


def test_without_a_page_the_context_is_the_open_tenders(client, bid, captured):
    client.post("/chat", json={"question": "Which tenders are open?"})

    assert "=== Vericore record: Open tenders ===" in captured.context
    assert "Supply and Installation of Corrosion-Resistant Piping System" in captured.context
    assert "bids from ABC Infrastructure Private Limited" in captured.context


def test_a_tender_page_sends_its_details_checklist_and_bids(client, conn, bid, captured):
    tender_id = conn.execute(
        text("SELECT tender_id FROM bids WHERE id = :id"), {"id": bid}
    ).scalar_one()

    response = client.post(
        "/chat", json={"tender_id": str(tender_id), "question": "What are the requirements?"}
    )

    assert response.status_code == 200
    assert "=== Vericore record: Tender details ===" in captured.context
    assert "Bid due date: 2026-09-15" in captured.context
    assert "=== Vericore record: Requirements checklist ===" in captured.context
    assert "=== Vericore record: Bids on this tender ===" in captured.context
    assert "ABC Infrastructure Private Limited: run" in captured.context


@pytest.mark.skipif(not (SEED / "gst_certificate.pdf").exists(), reason="fixtures missing")
def test_a_bid_page_sends_its_results_identifiers_and_documents(client, bid, captured):
    for name, content in (
        ("gst_certificate.pdf", (SEED / "gst_certificate.pdf").read_bytes()),
        ("gst_certificate.pdf", (SEED / "gst_certificate.pdf").read_bytes()),
        ("scan.pdf", _blank_pdf()),
    ):
        upload = client.post(
            f"/bids/{bid}/documents",
            files={"file": (name, content, "application/pdf")},
            data={"ingestion_mode": "auto_classify"},
        )
        assert upload.status_code == 201

    response = client.post("/chat", json={"bid_id": bid, "question": "What is the GSTIN?"})

    assert response.status_code == 200
    context = captured.context
    assert "=== Vericore record: Verification results for ABC Infrastructure" in context
    assert "GSTIN 33AABCA1234C1ZM" in context
    assert "No verdicts yet" in context
    # Uploaded twice, sent once: the same text twice only doubles the cost.
    assert context.count("=== Document: gst_certificate.pdf ===") == 1
    # A page with no text layer is labelled, not sent as empty page markers.
    assert f"=== Document: scan.pdf ===\nType: bidder document\n{UNREADABLE}" in context


def test_verdicts_older_than_the_latest_upload_are_marked_out_of_date(client, conn, bid, captured):
    upload = client.post(
        f"/bids/{bid}/documents",
        files={"file": ("scan.pdf", _blank_pdf(), "application/pdf")},
        data={"ingestion_mode": "auto_classify"},
    )
    assert upload.status_code == 201

    fresh = client.post("/chat", json={"bid_id": bid, "question": "Is anything missing?"})
    # Never verified, so there is nothing to be out of date.
    assert "OUT OF DATE" not in captured.context
    assert fresh.json()["notices"] == []

    conn.execute(
        text(
            "INSERT INTO verification_runs (bid_id, started_at) "
            "VALUES (:bid, now() - interval '1 hour')"
        ),
        {"bid": bid},
    )
    stale = client.post("/chat", json={"bid_id": bid, "question": "Is anything missing?"})
    assert "OUT OF DATE: 1 documents were uploaded after the last verification run" in (
        captured.context
    )
    # Stated by the server, not left to the model, which can skip the caveat.
    assert stale.json()["notices"] == [
        "Verdicts for ABC Infrastructure Private Limited are out of date: 1 documents were "
        "uploaded after its last verification run. Re-run verification to update them."
    ]


class _NamingChat(StubProvider):
    """Answers with a fixed summary, to test what the server links from it."""

    def __init__(self, summary: str) -> None:
        super().__init__()
        self.summary = summary

    def generate_chat(self, question: str, doc: DocumentInput, *, role: LLMRole) -> ChatAnswer:
        return ChatAnswer(summary=self.summary)


def _answering(client, summary: str) -> None:
    client.app.dependency_overrides[extraction_provider] = lambda: _NamingChat(summary)


def test_named_tenders_link_to_their_pages_told_apart_by_bid_number(client, conn, bid):
    first = conn.execute(
        text(
            "UPDATE tenders SET bid_number = 'DEMO/1' FROM bids WHERE bids.tender_id = tenders.id "
            "AND bids.id = :bid RETURNING tenders.id"
        ),
        {"bid": bid},
    ).scalar_one()
    second = conn.execute(
        text(
            "INSERT INTO tenders (title, bid_number) VALUES "
            "('Supply and Installation of Corrosion-Resistant Piping System', 'DEMO/2') "
            "RETURNING id"
        )
    ).scalar_one()
    # Different case and spacing from the stored title: still the same name.
    _answering(client, "The supply and installation of  corrosion-resistant piping system is open.")

    links = client.post("/chat", json={"question": "Which tenders are open?"}).json()["links"]

    title = "Supply and Installation of Corrosion-Resistant Piping System"
    assert {(link["entity"], link["label"], link["href"]) for link in links} == {
        (f"{title} (DEMO/1)", "Open tender", f"/tenders/{first}"),
        (f"{title} (DEMO/1)", "Checklist", f"/tenders/{first}/setup"),
        (f"{title} (DEMO/2)", "Open tender", f"/tenders/{second}"),
        (f"{title} (DEMO/2)", "Checklist", f"/tenders/{second}/setup"),
    }


def test_bidders_named_on_a_tender_page_link_to_their_bids(client, conn, bid):
    tender_id = conn.execute(
        text("SELECT tender_id FROM bids WHERE id = :id"), {"id": bid}
    ).scalar_one()
    _answering(client, "ABC Infrastructure Private Limited is the only bidder.")

    response = client.post("/chat", json={"tender_id": str(tender_id), "question": "Who has bid?"})

    assert response.json()["links"] == [
        {
            "entity": "ABC Infrastructure Private Limited",
            "label": "Open bid",
            "href": f"/bids/{bid}",
        }
    ]


def test_unknown_bid_or_tender_is_a_404(client):
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.post("/chat", json={"bid_id": missing, "question": "hi"}).status_code == 404
    assert client.post("/chat", json={"tender_id": missing, "question": "hi"}).status_code == 404


def test_context_under_the_cap_is_passed_whole():
    record = "=== Vericore record: Tender details ===\nTitle: Piping"
    context = build_context([record], [("gst.pdf", "bidder document", "[page 1]\nGSTIN")])
    assert context == (
        f"{record}\n\n=== Document: gst.pdf ===\nType: bidder document\n[page 1]\nGSTIN"
    )
    assert TRUNCATED_MARKER not in context


def test_records_are_capped_and_documents_share_the_rest_equally():
    long_text = "a" * MAX_CONTEXT_CHARS
    context = build_context(
        ["r" * MAX_CONTEXT_CHARS],
        [("first.pdf", "bidder document", long_text), ("second.pdf", "bidder document", long_text)],
    )
    records, first, second = context.split("\n\n=== Document: ")
    assert records == "r" * MAX_RECORD_CHARS + TRUNCATED_MARKER
    share = (MAX_CONTEXT_CHARS - len(records)) // 2
    assert first == "first.pdf ===\nType: bidder document\n" + "a" * share + TRUNCATED_MARKER
    assert second == "second.pdf ===\nType: bidder document\n" + "a" * share + TRUNCATED_MARKER


def _fake_openai(monkeypatch, content: str) -> dict:
    """Capture the request OpenAI would receive and reply with ``content``."""
    sent: dict = {}

    def fake_urlopen(request, timeout):
        sent.update(json.loads(request.data))
        body = {"choices": [{"message": {"content": content}}]}
        return io.BytesIO(json.dumps(body).encode())

    monkeypatch.setattr(openai_provider.urllib.request, "urlopen", fake_urlopen)
    return sent


def test_openai_chat_uses_the_cheap_model_capped_output_and_chat_prompt(monkeypatch):
    sent = _fake_openai(monkeypatch, json.dumps(STRUCTURED_ANSWER))
    provider = OpenAIProvider(api_key="test-key")

    answer = provider.generate_chat(
        "What is the GSTIN?", DocumentInput(text="[page 1]\nGSTIN"), role=LLMRole.EXTRACTION
    )

    assert answer == ChatAnswer.model_validate(STRUCTURED_ANSWER)
    assert sent["model"] == provider.model_id_for(LLMRole.EXTRACTION)
    assert sent["max_completion_tokens"] == CHAT_MAX_OUTPUT_TOKENS
    assert sent["response_format"]["json_schema"]["name"] == "chat_answer"
    system, user = sent["messages"]
    assert "UNTRUSTED" in system["content"]
    assert user["content"].endswith("QUESTION: What is the GSTIN?")


def test_openai_chat_answer_that_breaks_the_schema_is_an_llm_error(monkeypatch):
    _fake_openai(monkeypatch, json.dumps({"summary": "cut off", "sections": [{"heading": 1}]}))
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(LLMError, match="invalid chat answer"):
        provider.generate_chat("What is the GSTIN?", DocumentInput(), role=LLMRole.EXTRACTION)


class _CountingChat:
    name = "counting"
    supports_native_documents = False
    is_offline = True

    def __init__(self) -> None:
        self.calls = 0

    def model_id_for(self, role: LLMRole) -> str:
        return "counting-v1"

    def generate_chat(self, question: str, doc: DocumentInput, *, role: LLMRole) -> ChatAnswer:
        self.calls += 1
        return ChatAnswer(summary=f"answer {self.calls}")


def test_repeated_question_is_served_from_the_cache(tmp_path):
    inner = _CountingChat()
    provider = CachedProvider(inner, cache_dir=tmp_path)
    doc = DocumentInput(text="[page 1]\nGSTIN")

    first = provider.generate_chat("What is the GSTIN?", doc, role=LLMRole.EXTRACTION)
    second = provider.generate_chat("What is the GSTIN?", doc, role=LLMRole.EXTRACTION)
    other = provider.generate_chat("What is the PAN?", doc, role=LLMRole.EXTRACTION)

    assert first == second == ChatAnswer(summary="answer 1")
    assert other == ChatAnswer(summary="answer 2")
    assert inner.calls == 2


def test_cache_entry_in_an_old_shape_is_treated_as_a_miss(tmp_path):
    inner = _CountingChat()
    provider = CachedProvider(inner, cache_dir=tmp_path)
    provider.generate_chat("What is the GSTIN?", DocumentInput(), role=LLMRole.EXTRACTION)
    (entry,) = tmp_path.glob("*.json")
    entry.write_text(json.dumps("a plain-text answer from before answers were structured"))

    answer = provider.generate_chat("What is the GSTIN?", DocumentInput(), role=LLMRole.EXTRACTION)

    assert answer == ChatAnswer(summary="answer 2")
    assert json.loads(entry.read_text())["summary"] == "answer 2"
