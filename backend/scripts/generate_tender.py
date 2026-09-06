"""Generate a stand-in NIT with a DARPG-style pre-qualification table.

**This is not the DARPG RFP.** That document is not in ``seed/tender/``. This
file reproduces the *structure* CLAUDE.md §20 describes — a numbered §6
pre-qualification table whose rows carry a criterion, its detail, an
applicability column stating whether it binds the sole/prime bidder or any
consortium member, and the documents required — so the parser is written
against the real shape rather than an invented one.

To use the real document instead: drop it in ``seed/tender/`` and point
``POST /tenders`` at it. Nothing in the parser is specific to this file beyond
the row grammar, which is what §6 tables flatten to.

Run:  python scripts/generate_tender.py
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pymupdf

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT = REPO_ROOT / "seed" / "tender" / "nit_darpg_style.pdf"

# clause, title, detail, applicability, documents, mandatory, weight
ROWS: list[tuple[str, str, str, str, str, str, str]] = [
    (
        "6.1",
        "Legal entity",
        "The Bidder shall be a company registered under the Companies Act, 1956 or 2013, "
        "and shall have been in continuous operation for at least 5 years as on the bid due date.",
        "Sole Bidder or prime bidder of the Consortium",
        "Certificate of Incorporation",
        "Yes",
        "0",
    ),
    (
        "6.2",
        "Average annual turnover",
        "The Bidder shall have a minimum average annual turnover of Rs. 100,00,00,000 "
        "over the preceding 3 financial years.",
        "Sole Bidder or prime bidder of the Consortium",
        "Audited financial statements; CA turnover certificate",
        "Yes",
        "0",
    ),
    (
        "6.3",
        "GST registration",
        "The Bidder shall hold a valid and active GST registration in the name of the\n"
        "bidding entity.",
        "Sole Bidder and each consortium member",
        "GST registration certificate",
        "Yes",
        "0",
    ),
    (
        "6.4",
        "Permanent Account Number",
        "The Bidder shall hold a valid PAN issued in the name of the bidding company.",
        "Sole Bidder and each consortium member",
        "PAN card",
        "Yes",
        "0",
    ),
    (
        "6.5",
        "Similar work experience",
        "The Bidder shall have satisfactorily completed at least 1 similar work of value "
        "not less than Rs. 40,00,00,000 within the last 7 years as on the bid due date.",
        "Sole Bidder or any consortium member",
        "Work order and completion certificate",
        "Yes",
        "10",
    ),
    (
        "6.6",
        "MSME / Udyam registration",
        "Where the Bidder claims benefits reserved for Micro and Small Enterprises, "
        "a valid Udyam registration in the Micro or Small category shall be furnished.",
        "Sole Bidder or any consortium member",
        "Udyam registration certificate",
        "No",
        "5",
    ),
    (
        "6.7",
        "OEM authorisation",
        "The Bidder shall furnish a current authorisation from the Original Equipment "
        "Manufacturer for the tendered equipment, valid as on the bid due date.",
        "Sole Bidder or any consortium member",
        "OEM authorisation letter",
        "Yes",
        "8",
    ),
    (
        "6.8",
        "Quality management certification",
        "The Bidder shall hold a valid ISO 9001 quality management certification "
        "as on the bid due date.",
        "Sole Bidder or prime bidder of the Consortium",
        "ISO 9001 certificate",
        "Yes",
        "5",
    ),
    (
        "6.9",
        "Technical specification - capacity",
        "The offered piping system shall have a rated throughput of not less than 500 TPD.",
        "Sole Bidder or prime bidder of the Consortium",
        "Technical datasheet",
        "Yes",
        "10",
    ),
    (
        "6.10",
        "Technical specification - materials",
        "The materials of construction shall be suitable for corrosive and high-humidity "
        "service at the refinery unit.",
        "Sole Bidder or prime bidder of the Consortium",
        "Technical datasheet",
        "Yes",
        "10",
    ),
    (
        "6.11",
        "Earnest money deposit",
        "The Bidder shall furnish an EMD of Rs. 5,00,000 in an acceptable instrument, "
        "or claim a valid exemption.",
        "Sole Bidder or prime bidder of the Consortium",
        "EMD instrument or exemption declaration",
        "Yes",
        "0",
    ),
    (
        "6.12",
        "Non-blacklisting declaration",
        "The Bidder shall submit a signed declaration that it is not blacklisted or "
        "debarred by any Government department or public sector undertaking.",
        "Sole Bidder and each consortium member",
        "Non-blacklisting declaration",
        "Yes",
        "0",
    ),
    (
        "6.13",
        "Local content",
        "Where the Bidder claims Class-I local supplier status, the declared local content "
        "shall be not less than 50 percent.",
        "Sole Bidder or prime bidder of the Consortium",
        "Local content certificate",
        "No",
        "5",
    ),
    (
        "6.14",
        "Validity of certificates",
        "All statutory certificates submitted shall be valid as on the bid due date.",
        "Sole Bidder and each consortium member",
        "All submitted certificates",
        "Yes",
        "0",
    ),
    (
        "6.15",
        "Consistency of particulars",
        "The legal name, PAN and GSTIN of the Bidder shall be identical across all "
        "documents submitted with the bid.",
        "Sole Bidder and each consortium member",
        "All submitted documents",
        "Yes",
        "0",
    ),
    (
        "6.16",
        "EPFO registration",
        "Where the Bidder has employees covered under the Employees' Provident Fund and "
        "Miscellaneous Provisions Act, 1952, a valid EPFO registration shall be held, "
        "valid as on the bid due date.",
        "Sole Bidder or prime bidder of the Consortium",
        "EPFO registration certificate",
        "No",
        "3",
    ),
    (
        "6.17",
        "ESIC registration",
        "Where the Bidder has employees covered under the Employees' State Insurance "
        "Act, 1948, a valid ESIC registration shall be held, valid as on the bid due date.",
        "Sole Bidder or prime bidder of the Consortium",
        "ESIC registration certificate",
        "No",
        "3",
    ),
]


def build() -> Path:
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    ink = (0.07, 0.09, 0.15)

    def line(x, y, t, size=10, font="helv"):
        page.insert_text((x, y), t, fontsize=size, fontname=font, color=ink)

    line(120, 70, "Department of Administrative Reforms", 13, "hebo")
    line(120, 88, "and Public Grievances, Government of India", 13, "hebo")
    line(120, 118, "Request for Proposal", 12, "helv")
    line(120, 136, "Bid Reference: DARPG/2026/RFP/0114", 10, "cour")
    line(120, 154, "Bid Due Date: 15/09/2026", 10, "cour")
    line(120, 172, "Estimated Value: Rs. 62,00,00,000", 10, "cour")
    line(60, 220, "Section 6 - Pre-Qualification Criteria", 12, "hebo")
    line(60, 244, "Bids shall be evaluated against the criteria set out below. The", 10)
    line(60, 260, "applicability column states, for each criterion, whether it is to be", 10)
    line(60, 276, "met by the sole bidder, the prime bidder, or any consortium member.", 10)

    y = 310
    for clause, title, detail, applicability, documents, mandatory, weight in ROWS:
        if y > 720:
            page = doc.new_page(width=595, height=842)
            y = 70
        line(60, y, f"{clause}  {title}", 10, "hebo")
        y += 16
        for wrapped in textwrap.wrap(detail, width=88):
            line(74, y, wrapped, 9)
            y += 13
        line(74, y, f"Applicability: {applicability}", 9)
        y += 13
        line(74, y, f"Documents Required: {documents}", 9)
        y += 13
        line(74, y, f"Mandatory: {mandatory}    Weight: {weight}", 9)
        y += 22

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    doc.close()
    return OUT


if __name__ == "__main__":
    path = build()
    print(f"wrote {path.relative_to(REPO_ROOT)}  ({len(ROWS)} pre-qualification rows)")
    print("NOTE: stand-in for the DARPG RFP, which is absent from seed/tender/.")
