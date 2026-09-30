import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
# Adjust the import below based on your exact DB model for documents
from app.db.models import Document 
from app.modules.document_intelligence.pdf_reader import read_pdf, build_provider_text
from app.llm.factory import get_provider
from app.llm.types import LLMRole, DocumentInput

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
        # 1. Locate the physical file from the DB for this bid
        doc = db.query(Document).filter(Document.bid_id == request.bid_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="No documents found for this bid")
            
        # 2. Extract and translate the text (this automatically uses the Bhashini code we just wrote!)
        pdf = read_pdf(doc.storage_path)
        document_text = build_provider_text(pdf.pages)
        
        prompt = f"You are a helpful assistant analyzing a tender document.\n\n" \
                 f"DOCUMENT TEXT:\n{document_text}\n\n" \
                 f"QUESTION: {request.question}"
    else:
        # Basic general question without document context
        prompt = f"You are a helpful assistant for the Vericore procurement platform.\n\n" \
                 f"QUESTION: {request.question}"
                 
    # Fetch the provider and generate the answer
    llm = get_provider(LLMRole.REASONING)
    doc_input = DocumentInput(text=None) # We bundled the text into the prompt above
    answer = llm.generate_chat(prompt=prompt, doc=doc_input)
    
    return ChatResponse(answer=answer)
