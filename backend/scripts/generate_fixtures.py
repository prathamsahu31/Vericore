"""Generate the demo bidder documents as real PDFs with a real text layer.

CLAUDE.md §16: fixtures must be internally consistent. A GSTIN whose characters
3–12 do not equal its PAN, or a CIN whose embedded year contradicts the
incorporation certificate, would be flagged by our own validators and cost a
day debugging phantom failures. So the identifiers here are *computed*, not
typed: the GSTIN check character is calculated, and the CIN year is derived
from the incorporation date.

Run:  python scripts/generate_fixtures.py
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pymupdf

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_ROOT = REPO_ROOT / "seed" / "bidders"

_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def gstin_check_char(first14: str) -> str:
    """The 15th character of a GSTIN, per the standard mod-36 weighting."""
    total = 0
    for i, ch in enumerate(first14):
        value = _ALPHABET.index(ch)
        product = value * (2 if i % 2 else 1)
        total += product // 36 + product % 36
    return _ALPHABET[(36 - total % 36) % 36]


def build_gstin(state_code: str, pan: str, entity_number: str = "1") -> str:
    """State code + PAN + entity number + Z + computed check character.

    Characters 3–12 are the PAN by construction, which is exactly what the
    highest-value structural check in the system verifies (§9).
    """
    first14 = f"{state_code}{pan}{entity_number}Z"
    return first14 + gstin_check_char(first14)


@dataclass(frozen=True)
class Company:
    slug: str
    legal_name: str
    trade_name: str
    pan: str
    state_code: str
    state_abbr: str
    address: str
    pincode: str
    incorporated: str  # DD/MM/YYYY
    udyam_serial: str
    enterprise_type: str
    cin_industry: str
    cin_ownership: str
    cin_serial: str

    # Turnover for the three financial years the tender asks about, most recent
    # first, as printed on the certificate.
    turnover: tuple[str, str, str] = (
        "Rs. 1,18,00,00,000",
        "Rs. 1,02,00,00,000",
        "Rs. 96,00,00,000",
    )
    work_order_value: str = "Rs. 47,50,00,000"
    iso_valid_until: str = "18/09/2026"
    oem_valid_until: str = "31/12/2026"

    # ── Planted flaws (§16). Each is None for a clean bidder. ────────────
    #: A different PAN embedded in the GSTIN than the one on the PAN card. The
    #: single highest-value structural check in the system (§9), and the moment
    #: architecture.md §13 builds the demo around.
    gstin_embeds_pan: str | None = None
    #: The name as printed on the PAN card, when it differs from the GST
    #: certificate. A near-match that must be raised, never auto-resolved.
    name_on_pan: str | None = None
    #: Documents to leave out of the bundle entirely.
    omit: tuple[str, ...] = ()
    #: The entity the turnover certificate is issued to, when that is not the
    #: bidder. This is the holding-company case: the figure clears the
    #: threshold but belongs to someone else.
    turnover_entity: str | None = None
    turnover_entity_pan: str | None = None

    @property
    def gstin(self) -> str:
        return build_gstin(self.state_code, self.gstin_embeds_pan or self.pan)

    @property
    def cin(self) -> str:
        year = self.incorporated.split("/")[-1]
        return (
            f"U{self.cin_industry}{self.state_abbr}{year}" f"{self.cin_ownership}{self.cin_serial}"
        )

    @property
    def udyam_urn(self) -> str:
        return f"UDYAM-{self.state_abbr}-{self.state_code}-{self.udyam_serial}"

    @property
    def pan_name(self) -> str:
        return self.name_on_pan or self.legal_name


BIDDER_A = Company(
    slug="bidder_a",
    legal_name="ABC Infrastructure Private Limited",
    trade_name="ABC Infra",
    pan="AABCA1234C",  # 4th character C — a company, consistent with the CIN
    state_code="33",
    state_abbr="TN",
    address="14 Anna Salai, Guindy, Chennai",
    pincode="600032",
    incorporated="18/03/2015",
    udyam_serial="0041827",
    enterprise_type="Small",
    cin_industry="45200",
    cin_ownership="PTC",
    cin_serial="101234",
)


# ─────────────────────────────────────────────────────────────────────────────
# Bidder B — clearly problematic (§16)
#
# Four planted flaws, each exercising a different part of the engine, plus the
# GSTIN/PAN mismatch that architecture.md §13 builds the demo's key moment
# around. The GSTIN's own checksum stays valid, so the structural check passes
# and the PAN-embedding check is what catches it — otherwise the wrong finding
# fires first and masks the interesting one.
# ─────────────────────────────────────────────────────────────────────────────
BIDDER_B = Company(
    slug="bidder_b",
    legal_name="ABC Engineers Private Limited",  # as printed on the GST certificate
    name_on_pan="ABC Engineering Pvt Ltd",  # ... and differently on the PAN card
    trade_name="ABC Engineers",
    pan="AABCE5678K",
    gstin_embeds_pan="AABCE9999K",  # not the PAN on the card
    state_code="33",
    state_abbr="TN",
    address="7 Mount Poonamallee Road, Porur, Chennai",
    pincode="600116",
    incorporated="09/11/2017",
    udyam_serial="0055913",
    enterprise_type="Small",
    cin_industry="45201",
    cin_ownership="PTC",
    cin_serial="118742",
    # 62 Cr average against the 100 Cr the tender requires.
    turnover=("Rs. 65,00,00,000", "Rs. 62,00,00,000", "Rs. 59,00,00,000"),
    # Lapsed well before the 15/09/2026 bid due date.
    iso_valid_until="30/06/2026",
    omit=("oem_authorisation",),
)


# ─────────────────────────────────────────────────────────────────────────────
# Bidder C — genuinely ambiguous (§16)
#
# Nothing here is wrong. The turnover certificate clears the threshold four
# times over, and belongs to the bidder's holding company rather than to the
# bidder. Real oil-sector tenders permit exactly this, subject to an
# undertaking and a board resolution — both of which are in the bundle. Whether
# it is permitted under *this* tender is a policy judgement, and this bidder
# exists to prove the human-in-the-loop design is load-bearing rather than
# decorative.
# ─────────────────────────────────────────────────────────────────────────────
BIDDER_C = Company(
    slug="bidder_c",
    legal_name="Coastal Marine Works Private Limited",
    trade_name="Coastal Marine",
    pan="AADCC3344M",
    state_code="24",
    state_abbr="GJ",
    address="Plot 44, Dahej SEZ, Bharuch",
    pincode="392130",
    incorporated="22/07/2019",
    udyam_serial="0093166",
    enterprise_type="Small",
    cin_industry="45203",
    cin_ownership="PTC",
    cin_serial="109455",
    # The holding company's figures, on a certificate issued in its name.
    turnover=("Rs. 3,60,00,00,000", "Rs. 3,40,00,00,000", "Rs. 3,20,00,00,000"),
    turnover_entity="Coastal Holdings Limited",
    turnover_entity_pan="AAACH7788P",
    work_order_value="Rs. 44,00,00,000",
)


ALL_BIDDERS = (BIDDER_A, BIDDER_B, BIDDER_C)


def _page(doc: pymupdf.Document) -> pymupdf.Page:
    return doc.new_page(width=595, height=842)  # A4


def _write(page: pymupdf.Page, lines: list[tuple[float, float, str, int, str]]) -> None:
    for x, y, text, size, font in lines:
        page.insert_text((x, y), text, fontsize=size, fontname=font, color=(0.07, 0.09, 0.15))


def gst_certificate(c: Company, out: Path) -> Path:
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (150, 70, "Government of India", 13, "helv"),
            (110, 92, "Form GST REG-06 — Registration Certificate", 14, "hebo"),
            (60, 140, f"Registration Number (GSTIN) : {c.gstin}", 11, "cour"),
            (60, 168, f"Legal Name of Business : {c.legal_name}", 11, "helv"),
            (60, 192, f"Trade Name : {c.trade_name}", 11, "helv"),
            (60, 216, "Constitution of Business : Private Limited Company", 11, "helv"),
            (60, 240, "Date of Liability : 01/07/2017", 11, "helv"),
            (60, 264, "Status : Active", 11, "helv"),
            (60, 300, "Principal Place of Business", 11, "hebo"),
            (60, 322, f"{c.address}", 10, "helv"),
            (60, 340, f"{c.state_abbr} - {c.pincode}", 10, "helv"),
            (60, 400, "This is a system generated certificate.", 9, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def pan_card(c: Company, out: Path) -> Path:
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (150, 70, "Income Tax Department", 13, "helv"),
            (150, 90, "Government of India", 11, "helv"),
            (60, 150, "Permanent Account Number", 11, "hebo"),
            (60, 176, f"{c.pan}", 15, "cour"),
            (60, 220, f"Name : {c.pan_name}", 11, "helv"),
            (60, 246, f"Date of Incorporation : {c.incorporated}", 11, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def udyam_certificate(c: Company, out: Path) -> Path:
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (120, 70, "Ministry of Micro, Small and Medium Enterprises", 12, "helv"),
            (150, 94, "UDYAM REGISTRATION CERTIFICATE", 13, "hebo"),
            (60, 150, f"Udyam Registration Number : {c.udyam_urn}", 11, "cour"),
            (60, 178, f"Name of Enterprise : {c.legal_name}", 11, "helv"),
            (60, 202, f"Type of Enterprise : {c.enterprise_type}", 11, "helv"),
            (60, 226, "Major Activity : Services", 11, "helv"),
            (60, 250, "Date of Udyam Registration : 14/06/2021", 11, "helv"),
            (60, 286, f"Official Address : {c.address}, {c.state_abbr} - {c.pincode}", 10, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def incorporation_certificate(c: Company, out: Path) -> Path:
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (130, 70, "Ministry of Corporate Affairs", 13, "helv"),
            (140, 94, "Certificate of Incorporation", 14, "hebo"),
            (60, 150, f"Corporate Identity Number : {c.cin}", 11, "cour"),
            (60, 178, f"Name of Company : {c.legal_name}", 11, "helv"),
            (60, 202, f"Date of Incorporation : {c.incorporated}", 11, "helv"),
            (60, 226, "Registrar of Companies : Chennai", 11, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def work_order(c: Company, out: Path) -> Path:
    """Includes a description long enough to wrap, so multi-line spans get exercised."""
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (150, 70, "Chennai Petroleum Corporation Limited", 12, "hebo"),
            (180, 94, "Work Order / Completion Certificate", 12, "helv"),
            (60, 150, "Work Order No. : CPCL/ENG/2022/0417", 11, "cour"),
            (60, 178, "Awarded By : Chennai Petroleum Corporation Limited", 11, "helv"),
            (60, 202, f"Contractor : {c.legal_name}", 11, "helv"),
            (60, 226, f"Order Value : {c.work_order_value}", 11, "helv"),
            (60, 250, "Date of Completion : 22/11/2023", 11, "helv"),
            (60, 286, "Description of Work : Supply, fabrication and installation of", 11, "helv"),
            (60, 304, "corrosion resistant piping systems including hydrotesting and", 11, "helv"),
            (60, 322, "commissioning at the Manali refinery unit.", 11, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def ca_turnover_certificate(c: Company, out: Path) -> Path:
    """The figures the turnover condition is judged on.

    ``turnover_entity`` is the holding-company case: the certificate is issued
    to a different legal person than the bidder, so the figure clears the
    threshold while belonging to someone else.
    """
    entity = c.turnover_entity or c.legal_name
    entity_pan = c.turnover_entity_pan or c.pan
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (150, 70, "Statement of Turnover", 14, "hebo"),
            (150, 92, "Certified by Chartered Accountant", 11, "helv"),
            (60, 150, f"Name of Entity : {entity}", 11, "helv"),
            (60, 176, f"Permanent Account Number : {entity_pan}", 11, "cour"),
            (60, 214, "Audited turnover for the preceding three financial years:", 11, "helv"),
            (60, 242, f"FY 2023-24 : {c.turnover[0]}", 11, "helv"),
            (60, 266, f"FY 2022-23 : {c.turnover[1]}", 11, "helv"),
            (60, 290, f"FY 2021-22 : {c.turnover[2]}", 11, "helv"),
            (60, 330, "Membership No. : 214872", 10, "helv"),
            (60, 350, "UDIN : 24214872BKFAAB1234", 10, "cour"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def holding_company_undertaking(c: Company, out: Path) -> Path:
    """Only produced where a holding company's turnover is being relied on.

    Real oil-sector tenders permit this, subject to an undertaking and a board
    resolution. Whether it is permitted *here* is a policy judgement for the
    officer, which is exactly why this bidder exists (§16).
    """
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (110, 70, "Letter of Undertaking and Board Resolution", 13, "hebo"),
            (60, 140, f"Bidding Entity : {c.legal_name}", 11, "helv"),
            (60, 166, f"Holding Company : {c.turnover_entity}", 11, "helv"),
            (60, 192, "Shareholding : 100 percent", 11, "helv"),
            (60, 230, "The holding company undertakes to make available its financial", 10, "helv"),
            (60, 248, "and technical resources to the bidding entity for the full", 10, "helv"),
            (60, 266, "duration of the contract, and accepts joint and several", 10, "helv"),
            (60, 284, "liability for performance.", 10, "helv"),
            (60, 320, "Board Resolution Reference : CMW/BR/2026/014", 11, "cour"),
            (60, 344, "Date of Resolution : 04/08/2026", 11, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def iso_certificate(c: Company, out: Path) -> Path:
    """Valid until three days after the bid due date — Bidder A's subtle
    near-miss from CLAUDE.md §16. It passes, and the margin is reported."""
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (150, 70, "ISO 9001:2015 Certificate", 14, "hebo"),
            (150, 92, "Quality Management System", 11, "helv"),
            (60, 150, "Certificate Number : IN-QMS-2023-88141", 11, "cour"),
            (60, 176, f"Name of Organisation : {c.legal_name}", 11, "helv"),
            (60, 200, "Standard : ISO 9001:2015", 11, "helv"),
            (60, 224, "Scope : Fabrication and installation of piping systems", 11, "helv"),
            (60, 248, "Date of Issue : 19/09/2023", 11, "helv"),
            (60, 272, f"Valid Until : {c.iso_valid_until}", 11, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def oem_authorisation(c: Company, out: Path) -> Path:
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (150, 70, "Manufacturer's Authorisation Letter", 13, "hebo"),
            (60, 130, "Issued By OEM : Hindustan Alloy Systems Limited", 11, "helv"),
            (60, 156, f"Authorised Party : {c.legal_name}", 11, "helv"),
            (60, 180, "Product Scope : Corrosion resistant alloy piping and fittings", 11, "helv"),
            (60, 204, f"Valid Until : {c.oem_valid_until}", 11, "helv"),
            (60, 240, "We confirm the above party is authorised to supply and service", 10, "helv"),
            (60, 258, "our products for the tendered requirement.", 10, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def technical_datasheet(c: Company, out: Path) -> Path:
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (150, 70, "Technical Datasheet", 14, "hebo"),
            (60, 130, f"Bidder : {c.legal_name}", 11, "helv"),
            (60, 156, "Model : HAS-CRP-520", 11, "cour"),
            (60, 180, "Rated Throughput : 520 TPD", 11, "helv"),
            (60, 204, "Design Pressure : 16 bar", 11, "helv"),
            (60, 240, "Material of Construction : Duplex stainless steel UNS S31803", 11, "helv"),
            (60, 258, "with epoxy-phenolic internal lining, selected for sustained", 11, "helv"),
            (60, 276, "service in chloride-bearing and high-humidity atmospheres.", 11, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def declaration_non_blacklisting(c: Company, out: Path) -> Path:
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (140, 70, "Declaration of Non-Blacklisting", 13, "hebo"),
            (60, 140, f"Name of Bidder : {c.legal_name}", 11, "helv"),
            (60, 166, f"Permanent Account Number : {c.pan}", 11, "cour"),
            (60, 204, "We hereby declare that the bidder is not blacklisted, debarred", 10, "helv"),
            (60, 222, "or suspended by any Government department, public sector", 10, "helv"),
            (60, 240, "undertaking or statutory authority as on the date of this bid.", 10, "helv"),
            (60, 280, "Declaration Signed : Yes", 11, "helv"),
            (60, 304, "Date of Declaration : 20/08/2026", 11, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


def emd_instrument(c: Company, out: Path) -> Path:
    doc = pymupdf.open()
    page = _page(doc)
    _write(
        page,
        [
            (150, 70, "Bank Guarantee - Earnest Money Deposit", 12, "hebo"),
            (60, 140, f"Applicant : {c.legal_name}", 11, "helv"),
            (60, 166, "Instrument Type : Bank Guarantee", 11, "helv"),
            (60, 190, "EMD Amount : Rs. 5,00,000", 11, "helv"),
            (60, 214, "Beneficiary : Chennai Petroleum Corporation Limited", 11, "helv"),
            (60, 238, "Valid Until : 15/12/2026", 11, "helv"),
        ],
    )
    doc.save(out)
    doc.close()
    return out


BUILDERS = {
    "gst_certificate": gst_certificate,
    "pan_card": pan_card,
    "udyam_certificate": udyam_certificate,
    "incorporation_certificate": incorporation_certificate,
    "work_order": work_order,
    "ca_turnover_certificate": ca_turnover_certificate,
    "iso_certificate": iso_certificate,
    "oem_authorisation": oem_authorisation,
    "technical_datasheet": technical_datasheet,
    "declaration_non_blacklisting": declaration_non_blacklisting,
    "emd_instrument": emd_instrument,
    "holding_company_undertaking": holding_company_undertaking,
}

# Deliberately absent from Bidder A's bundle, so MISSING_EVIDENCE is a state the
# demo actually exercises: local_content_certificate (§6.13, not mandatory).


def generate(company: Company) -> list[Path]:
    """Write the bundle, minus anything this bidder deliberately does not have."""
    out_dir = OUT_ROOT / company.slug
    out_dir.mkdir(parents=True, exist_ok=True)
    for stale in out_dir.glob("*.pdf"):
        stale.unlink()

    written = []
    for name, build in BUILDERS.items():
        if name in company.omit:
            continue
        if name == "holding_company_undertaking" and not company.turnover_entity:
            continue
        written.append(build(company, out_dir / f"{name}.pdf"))
    return written


if __name__ == "__main__":
    for c in ALL_BIDDERS:
        print(f"\n{c.legal_name}  ({c.slug})")
        print(
            f"  PAN   {c.pan}" + (f"   on the card as '{c.name_on_pan}'" if c.name_on_pan else "")
        )
        embedded = c.gstin[2:12]
        note = "consistent" if embedded == c.pan else f"MISMATCH — embeds {embedded}"
        print(f"  GSTIN {c.gstin}   {note}")
        print(f"  CIN   {c.cin}   year matches incorporation: {c.cin[8:12] == c.incorporated[-4:]}")
        print(f"  Udyam {c.udyam_urn}")
        if c.turnover_entity:
            print(f"  turnover certificate issued to: {c.turnover_entity}  (NOT the bidder)")
        if c.omit:
            print(f"  deliberately absent: {', '.join(c.omit)}")
        for path in generate(c):
            print(f"    {path.relative_to(REPO_ROOT)}")
