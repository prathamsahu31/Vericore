import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.db.models import Document
from app.modules.document_intelligence.pdf_reader import read_pdf, build_provider_text
from app.llm.factory import get_provider
from app.llm.base import LLMError
from app.llm.types import LLMRole, DocumentInput

log = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chatbot"])


class ChatRequest(BaseModel):
    bid_id: uuid.UUID | None = None
    question: str


class ChatResponse(BaseModel):
    answer: str


@router.post("", response_model=ChatResponse)
def ask_document_question(request: ChatRequest, db: Session = Depends(get_db)):
    prompt = ""

    if request.bid_id:
        # 1. Locate ALL documents for this bid (not just the first one)
        docs = (
            db.execute(
                select(Document)
                .where(Document.bid_id == request.bid_id)
                .order_by(Document.uploaded_at)
            )
            .scalars()
            .all()
        )
        if not docs:
            raise HTTPException(status_code=404, detail="No documents found for this bid")

        # 2. Extract and translate text from every document, then concatenate
        all_text_parts: list[str] = []
        for doc in docs:
            try:
                pdf = read_pdf(doc.storage_path)
                text = build_provider_text(pdf.pages)
                if text.strip():
                    all_text_parts.append(text)
            except Exception as exc:
                log.warning("Failed to read document %s: %s", doc.id, exc)
                continue

        if not all_text_parts:
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from any of the uploaded documents."
            )

        document_text = "\n\n---\n\n".join(all_text_parts)

        prompt = (
            f"You are a helpful assistant analyzing tender/bid documents.\n\n"
            f"DOCUMENT TEXT:\n{document_text}\n\n"
            f"QUESTION: {request.question}"
        )
    else:
        # Basic general question without document context
        prompt = (
            f"You are a helpful assistant for the Vericore procurement platform. "
            f"Vericore verifies bidder-submitted evidence against tender-specific "
            f"requirements for Government e-Marketplace (GeM) procurement.\n\n"
            f"QUESTION: {request.question}"
        )

    # Fetch the provider and generate the answer
    try:
        llm = get_provider(LLMRole.REASONING)
        doc_input = DocumentInput(text=None)
        answer = llm.generate_chat(prompt=prompt, doc=doc_input)
    except LLMError as exc:
        log.error("Chat LLM call failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"AI service is temporarily unavailable. Please try again in a moment."
        )

    return ChatResponse(answer=answer)
