import pymupdf
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime

@dataclass
class ForgerySignal:
    risk_level: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    reason: str
    details: str

def parse_pdf_date(date_str: str) -> datetime | None:
    """Parse standard PDF date format: D:YYYYMMDDHHmmSS"""
    if not date_str or not date_str.startswith("D:"):
        return None
    try:
        # Extract just the YYYYMMDDHHMMSS part, ignoring timezone offsets
        clean_date = date_str[2:16]
        return datetime.strptime(clean_date, "%Y%m%d%H%M%S")
    except ValueError:
        return None

def analyze_document_forgery(pdf_path: str | Path) -> list[ForgerySignal]:
    """
    Analyzes a PDF for signs of digital tampering and forgery.
    Returns a list of detected red flags.
    """
    signals = []
    
    try:
        with pymupdf.open(pdf_path) as doc:
            metadata = doc.metadata
            
            # 1. Metadata Checks (Producer / Creator)
            producer = (metadata.get("producer") or "").lower()
            creator = (metadata.get("creator") or "").lower()
            suspicious_software = ["photoshop", "gimp", "illustrator", "ilovepdf", "pdf24"]
            
            for software in suspicious_software:
                if software in producer or software in creator:
                    signals.append(ForgerySignal(
                        risk_level="HIGH",
                        reason="Suspicious PDF Producer Software",
                        details=f"The document metadata indicates it was processed using {software.title()}, which is commonly used for image manipulation."
                    ))
            
            # 2. Chronological Tampering (Modification Date vs Creation Date)
            creation_date_str = metadata.get("creationDate")
            mod_date_str = metadata.get("modDate")
            
            if creation_date_str and mod_date_str and creation_date_str != mod_date_str:
                created = parse_pdf_date(creation_date_str)
                modified = parse_pdf_date(mod_date_str)
                
                if created and modified:
                    time_diff = modified - created
                    # If modified more than 24 hours after creation, flag it
                    if time_diff.total_seconds() > 86400:
                        signals.append(ForgerySignal(
                            risk_level="MEDIUM",
                            reason="Document Digitally Altered Post-Creation",
                            details=f"Document was created on {created.date()} but modified on {modified.date()}. This could indicate post-issuance tampering."
                        ))

            # 3. Hidden / Overlaid Elements Check (e.g. pasted signatures)
            # We count images per page. If a document has exactly 1 large image (scanned page) 
            # and then 1 tiny image overlaid on top (a pasted fake signature), that's a red flag.
            for page_num, page in enumerate(doc, start=1):
                images = page.get_images()
                
                if len(images) > 1:
                    image_sizes = []
                    for img in images:
                        xref = img[0]
                        base_image = doc.extract_image(xref)
                        if base_image:
                            width = base_image.get("width", 0)
                            height = base_image.get("height", 0)
                            image_sizes.append(width * height)
                    
                    if image_sizes:
                        max_img = max(image_sizes)
                        tiny_images = [s for s in image_sizes if s > 0 and s < (max_img * 0.05)]
                        
                        if max_img > 1000000 and len(tiny_images) > 0:
                            signals.append(ForgerySignal(
                                risk_level="HIGH",
                                reason="Suspicious Image Overlays Detected",
                                details=f"Page {page_num} contains a full-page scan overlaid with tiny image patches. This is a strong indicator of a pasted signature or altered text."
                            ))

    except Exception as e:
        signals.append(ForgerySignal(
            risk_level="MEDIUM",
            reason="Corrupted or Encrypted PDF",
            details=f"Could not fully analyze document integrity: {str(e)}"
        ))
        
    return signals

if __name__ == "__main__":
    # Test it out directly if you run this file!
    import sys
    if len(sys.argv) > 1:
        results = analyze_document_forgery(sys.argv[1])
        if not results:
            print("✅ No forgery signals detected.")
        for r in results:
            print(f"[{r.risk_level}] {r.reason}: {r.details}")
