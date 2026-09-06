"""Run the full three-bidder demo end to end and print the comparison.

    python scripts/run_demo.py

The Day 4 definition of done in CLAUDE.md §15: upload -> evaluation -> matrix,
for every bidder, without anyone touching a database console. Each bidder is
built to exercise a different part of the engine (§16), so a run that produces
three identical-looking results means something is wrong.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

os.environ.setdefault("BID_DUE_DATE_OVERRIDE", "2026-09-15")
os.environ.setdefault("LLM_PROVIDER", "stub")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db.session import engine  # noqa: E402
from app.main import create_app  # noqa: E402

SEED = REPO_ROOT / "seed"

BIDDERS = [
    ("bidder_a", "ABC Infrastructure Private Limited", "AABCA1234C", "33AABCA1234C1ZM"),
    ("bidder_b", "ABC Engineers Private Limited", "AABCE5678K", "33AABCE9999K1ZX"),
    ("bidder_c", "Coastal Marine Works Private Limited", "AADCC3344M", "24AADCC3344M1ZP"),
]


def main() -> int:
    client = TestClient(create_app())

    tender = client.post(
        "/tenders",
        json={
            "title": "Supply and Installation of Corrosion-Resistant Piping System",
            "bid_number": f"DEMO/{os.getpid()}",
            "bid_due_date": "2026-09-15",
            "contract_start_date": "2026-11-01",
            "estimated_value": "620000000",
        },
    ).json()

    with open(SEED / "tender" / "nit_darpg_style.pdf", "rb") as fh:
        client.post(
            f"/tenders/{tender['id']}/document",
            files={"file": ("nit.pdf", fh, "application/pdf")},
        )
    requirements = client.post(f"/tenders/{tender['id']}/extract-requirements").json()
    client.post(f"/tenders/{tender['id']}/confirm-requirements")
    print(f"Tender: {len(requirements)} requirements, checklist confirmed\n")

    summaries = []
    for slug, name, pan, gstin in BIDDERS:
        bidder = client.post(
            "/bidders", json={"legal_name": name, "pan": pan, "gstin": gstin}
        ).json()
        bid = client.post(
            "/bids", json={"tender_id": tender["id"], "bidder_id": bidder["id"]}
        ).json()

        documents = sorted((SEED / "bidders" / slug).glob("*.pdf"))
        for path in documents:
            with open(path, "rb") as fh:
                client.post(
                    f"/bids/{bid['id']}/documents",
                    files={"file": (path.name, fh, "application/pdf")},
                    data={"ingestion_mode": "auto_classify"},
                )
        summary = client.post(f"/bids/{bid['id']}/verify").json()
        summaries.append((slug, summary, len(documents)))
        print(f"  {slug}: {len(documents)} documents -> verified")

    _comparison(summaries)
    _detail(summaries)
    return 0


def _comparison(summaries) -> None:
    print("\n" + "=" * 100)
    print(f"{'BIDDER':<36}{'SCORE':>7}{'RISK':>10}{'FAILED':>8}{'PENDING':>9}{'QUALIFIABLE':>13}")
    print("=" * 100)
    for _slug, s, _ in summaries:
        print(
            f"{s['bidder_name'][:34]:<36}{s['compliance_score']:>7}{s['risk_level']:>10}"
            f"{len(s['mandatory_failed']):>8}{len(s['pending_review']):>9}"
            f"{('yes' if s['qualifiable'] else 'no'):>13}"
        )


def _detail(summaries) -> None:
    for slug, s, _ in summaries:
        print("\n" + "-" * 100)
        print(f"{s['bidder_name']}  ({slug})")
        print("-" * 100)
        counts = " · ".join(f"{k} {v}" for k, v in sorted(s["status_counts"].items()))
        print(f"  states: {counts}")

        outstanding = [
            r
            for r in s["requirements"]
            if (r["effective_status"] or r["status"]) not in ("COMPLIANT", "NOT_APPLICABLE")
        ]
        if outstanding:
            print("  outstanding:")
            for r in outstanding:
                status = r["effective_status"] or r["status"]
                print(f"    {r['requirement_code']}  {status:<20} {r['requirement_name'][:44]}")

        if s["cross_document_findings"]:
            print("  contradictions:")
            for f in s["cross_document_findings"]:
                print(f"    [{f['severity']:<8}] {f['description'][:88]}")

        if s["risk_flags"]:
            print("  risk signals:")
            for f in s["risk_flags"]:
                print(f"    [{f['severity']:<8}] {f['code']}")


if __name__ == "__main__":
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        print(
            "No database. Run `docker compose up -d` from the repository root, "
            "then `alembic upgrade head` from backend/."
        )
        raise SystemExit(1) from None
    raise SystemExit(main())
