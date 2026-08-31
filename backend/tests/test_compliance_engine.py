"""Routing, the nine-state machine, cross-document checks, scoring and risk.

Pure logic: model objects are built in memory, never persisted, so these run
without a database and cover the states an end-to-end run on one clean bidder
would never reach.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.db.enums import ComplianceStatus, LocatorStatus, RiskLevel, Severity
from app.db.models import DocumentSegment, ExtractedField, Requirement
from app.llm.providers.stub import StubProvider
from app.modules.compliance_engine import cross_document, engine, scoring
from app.modules.compliance_engine.evidence_index import BidEvidence, route

DUE = date(2026, 9, 15)
PROVIDER = StubProvider()


# ─────────────────────────────────────────────────────────────────────────────
# Builders
# ─────────────────────────────────────────────────────────────────────────────
def seg(doc_type: str) -> DocumentSegment:
    s = DocumentSegment(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        segment_index=0,
        doc_type=doc_type,
        page_start=1,
        page_end=1,
        boundary_method="whole_file",
    )
    return s


def fld(segment, name, value, locator=LocatorStatus.EXACT) -> ExtractedField:
    return ExtractedField(
        id=uuid.uuid4(),
        document_segment_id=segment.id,
        field_name=name,
        field_value=value,
        page=1,
        x0=0,
        y0=0,
        x1=10,
        y1=10,
        locator_status=locator,
        confidence=0.9,
        extraction_method="test",
    )


def index(*pairs) -> BidEvidence:
    ev = BidEvidence(segments=[s for s, _ in pairs], fields_by_segment={})
    for s, fields in pairs:
        ev.fields_by_segment[s.id] = fields
    return ev


def req(**kw) -> Requirement:
    defaults = dict(
        id=uuid.uuid4(),
        tender_id=uuid.uuid4(),
        code="REQ-001",
        name="Test",
        category="statutory",
        mandatory=True,
        weight=Decimal(0),
        applicability_scope="lead_only",
        accepts_document_types=[],
        required_fields=[],
        display_order=0,
        condition=None,
        external_check=None,
    )
    defaults.update(kw)
    return Requirement(**defaults)


# ─────────────────────────────────────────────────────────────────────────────
# Routing (CLAUDE.md §21)
# ─────────────────────────────────────────────────────────────────────────────
def test_routing_considers_only_accepted_document_types():
    gst, pan = seg("gst_certificate"), seg("pan_card")
    ev = index((gst, []), (pan, []))
    result = route(req(accepts_document_types=["gst_certificate"]), ev)
    assert [s.doc_type for s in result.segments] == ["gst_certificate"]


def test_routing_names_what_is_missing_rather_than_failing_bare():
    ev = index((seg("gst_certificate"), []))
    result = route(req(accepts_document_types=["oem_authorisation"]), ev)
    assert not result.has_evidence
    assert result.missing_document_types == ["oem_authorisation"]


def test_routing_returns_every_matching_segment_not_just_the_first():
    """Two GST certificates: both are evaluated, so disagreement can surface."""
    a, b = seg("gst_certificate"), seg("gst_certificate")
    result = route(req(accepts_document_types=["gst_certificate"]), index((a, []), (b, [])))
    assert len(result.segments) == 2


def test_a_wildcard_requirement_routes_to_every_segment():
    ev = index((seg("gst_certificate"), []), (seg("pan_card"), []))
    assert len(route(req(accepts_document_types=["*"]), ev).segments) == 2


def test_a_requirement_accepting_nothing_routes_to_nothing():
    ev = index((seg("gst_certificate"), []))
    assert not route(req(accepts_document_types=[]), ev).has_evidence


# ─────────────────────────────────────────────────────────────────────────────
# The nine states
# ─────────────────────────────────────────────────────────────────────────────
def test_absent_document_is_missing_evidence_not_failure():
    """CLAUDE.md §2 rule 5: missing evidence routes to clarification."""
    verdict = engine.evaluate(
        req(accepts_document_types=["oem_authorisation"]),
        index((seg("pan_card"), [])),
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.MISSING_EVIDENCE
    assert "oem authorisation" in verdict.reasoning.lower()
    assert "clarification" in verdict.reasoning


def test_a_met_threshold_is_compliant():
    s = seg("technical_datasheet")
    ev = index((s, [fld(s, "rated_throughput_tpd", "520")]))
    verdict = engine.evaluate(
        req(
            accepts_document_types=["technical_datasheet"],
            condition={"field": "rated_throughput_tpd", "operator": ">=", "threshold": 500},
        ),
        ev,
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.COMPLIANT
    assert verdict.field_ids


def test_a_failed_threshold_is_non_compliant_and_states_the_shortfall():
    s = seg("technical_datasheet")
    ev = index((s, [fld(s, "rated_throughput_tpd", "410")]))
    verdict = engine.evaluate(
        req(
            accepts_document_types=["technical_datasheet"],
            condition={"field": "rated_throughput_tpd", "operator": ">=", "threshold": 500},
        ),
        ev,
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.NON_COMPLIANT
    assert "Shortfall" in verdict.reasoning


def test_an_accepted_document_missing_its_field_needs_human_review():
    """§21: link to the segment so the officer can read the value themselves."""
    s = seg("technical_datasheet")
    ev = index((s, [fld(s, "model", "HAS-CRP-520")]))
    verdict = engine.evaluate(
        req(
            accepts_document_types=["technical_datasheet"],
            condition={"field": "rated_throughput_tpd", "operator": ">=", "threshold": 500},
        ),
        ev,
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.NEEDS_HUMAN_REVIEW


def test_a_lapsed_certificate_is_expired_not_non_compliant():
    """EXPIRED is its own state: it would have satisfied, but for the date."""
    s = seg("iso_certificate")
    ev = index((s, [fld(s, "valid_until", "01/08/2026")]))
    verdict = engine.evaluate(
        req(
            accepts_document_types=["iso_certificate"],
            condition={"field": "valid_until", "operator": "not_expired_at_due_date"},
        ),
        ev,
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.EXPIRED


def test_a_certificate_expiring_after_the_due_date_passes_and_reports_the_margin():
    """Bidder A's planted near-miss (CLAUDE.md §16)."""
    s = seg("iso_certificate")
    ev = index((s, [fld(s, "valid_until", "18/09/2026")]))
    verdict = engine.evaluate(
        req(
            accepts_document_types=["iso_certificate"],
            condition={"field": "valid_until", "operator": "not_expired_at_due_date"},
        ),
        ev,
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.COMPLIANT
    assert "3 day(s) after" in verdict.reasoning


def test_a_prose_requirement_is_referred_to_a_human_by_policy():
    """CLAUDE.md §15: semantic judgement is always human-reviewed."""
    s = seg("technical_datasheet")
    ev = index(
        (
            s,
            [
                fld(s, "model", "HAS-CRP-520"),
                fld(s, "material_of_construction", "Duplex stainless steel, corrosion resistant"),
            ],
        )
    )
    verdict = engine.evaluate(
        req(category="technical", accepts_document_types=["technical_datasheet"]),
        ev,
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.NEEDS_HUMAN_REVIEW
    # Quotes the descriptive field, not the model number.
    assert "Duplex" in verdict.reasoning


def test_an_unlocated_value_can_never_be_automatically_compliant():
    """CLAUDE.md §24: a page-fallback box may not produce a silent pass."""
    s = seg("technical_datasheet")
    ev = index((s, [fld(s, "rated_throughput_tpd", "520", LocatorStatus.PAGE_FALLBACK)]))
    verdict = engine.evaluate(
        req(
            accepts_document_types=["technical_datasheet"],
            condition={"field": "rated_throughput_tpd", "operator": ">=", "threshold": 500},
        ),
        ev,
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.NEEDS_HUMAN_REVIEW


def test_turnover_below_threshold_is_non_compliant():
    """Bidder B's planted failure: 62 Cr against 100 Cr required."""
    s = seg("ca_turnover_certificate")
    ev = index(
        (
            s,
            [
                fld(s, "turnover_fy1", "Rs. 65,00,00,000"),
                fld(s, "turnover_fy2", "Rs. 62,00,00,000"),
                fld(s, "turnover_fy3", "Rs. 59,00,00,000"),
            ],
        )
    )
    verdict = engine.evaluate(
        req(
            accepts_document_types=["ca_turnover_certificate"],
            condition={
                "field": "average_annual_turnover",
                "operator": ">=",
                "threshold": 1000000000,
                "period_years": 3,
            },
        ),
        ev,
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.NON_COMPLIANT
    assert len(verdict.field_ids) == 3


def test_an_incomplete_turnover_series_needs_review_rather_than_a_wrong_average():
    s = seg("ca_turnover_certificate")
    ev = index((s, [fld(s, "turnover_fy1", "Rs. 1,20,00,00,000")]))
    verdict = engine.evaluate(
        req(
            accepts_document_types=["ca_turnover_certificate"],
            condition={
                "field": "average_annual_turnover",
                "operator": ">=",
                "threshold": 1000000000,
                "period_years": 3,
            },
        ),
        ev,
        DUE,
        PROVIDER,
    )
    assert verdict.status is ComplianceStatus.NEEDS_HUMAN_REVIEW


def test_an_unavailable_portal_is_unverified_never_non_compliant():
    """CLAUDE.md §8: a portal being down must never cost a bidder their tender."""
    from app.modules.verification_adapter.adapter import get_adapter

    verdict = engine.Verdict(
        requirement_id=uuid.uuid4(), status=ComplianceStatus.COMPLIANT, reasoning="ok"
    )
    result = get_adapter("nsic").verify("ANYTHING", {})
    assert result.status == "unavailable"
    verdict = engine.apply_external(verdict, result)
    assert verdict.status is ComplianceStatus.UNVERIFIED
    assert "no claim is made" in verdict.reasoning


def test_every_external_result_is_labelled_simulated():
    """CLAUDE.md §2 rule 2."""
    from app.modules.verification_adapter.adapter import get_adapter

    for portal in ("gstn", "udyam", "pan", "mca21", "blacklist", "nsic"):
        assert get_adapter(portal).verify("X", {}).source == "simulated"


# ─────────────────────────────────────────────────────────────────────────────
# Cross-document checks (CLAUDE.md §13)
# ─────────────────────────────────────────────────────────────────────────────
def test_a_gstin_that_does_not_embed_the_submitted_pan_is_critical():
    gst, pan = seg("gst_certificate"), seg("pan_card")
    ev = index(
        (gst, [fld(gst, "gstin", "33AABCA1234C1ZM")]), (pan, [fld(pan, "pan", "AABCB9999B")])
    )
    findings = cross_document.run(ev, bidder=None)
    hit = next(f for f in findings if f.finding_type == "gstin_pan_mismatch")
    assert hit.severity is Severity.CRITICAL


def test_a_consistent_bidder_produces_no_findings():
    gst, pan = seg("gst_certificate"), seg("pan_card")
    ev = index(
        (
            gst,
            [
                fld(gst, "gstin", "33AABCA1234C1ZM"),
                fld(gst, "legal_name", "ABC Infrastructure Private Limited"),
            ],
        ),
        (
            pan,
            [
                fld(pan, "pan", "AABCA1234C"),
                fld(pan, "legal_name", "ABC Infrastructure Private Limited"),
            ],
        ),
    )
    assert cross_document.run(ev, bidder=None) == []


def test_a_near_match_name_is_raised_for_a_human_not_resolved():
    """Bidder B: 'ABC Engineering' against 'ABC Engineers' (CLAUDE.md §9)."""
    a, b = seg("pan_card"), seg("gst_certificate")
    ev = index(
        (a, [fld(a, "legal_name", "ABC Engineering Pvt Ltd")]),
        (b, [fld(b, "legal_name", "ABC Engineers Private Limited")]),
    )
    findings = cross_document.run(ev, bidder=None)
    hit = next(f for f in findings if f.finding_type == "legal_name_variance")
    assert hit.similarity_score is not None
    # The steps are shown, so the officer can see what was folded away.
    assert hit.normalization_steps["left_steps"]


def test_a_differing_pan_across_documents_is_critical():
    a, b = seg("pan_card"), seg("declaration_non_blacklisting")
    ev = index((a, [fld(a, "pan", "AABCA1234C")]), (b, [fld(b, "pan", "AABCD5678D")]))
    findings = cross_document.run(ev, bidder=None)
    assert any(f.finding_type == "pan_mismatch" for f in findings)


def test_an_individual_pan_on_a_company_bid_is_flagged():
    a = seg("pan_card")
    ev = index((a, [fld(a, "pan", "AABPA1234C")]))
    findings = cross_document.run(ev, bidder=None)
    assert any(f.finding_type == "pan_holder_type_mismatch" for f in findings)


def test_two_documents_of_the_same_type_are_noted():
    ev = index((seg("gst_certificate"), []), (seg("gst_certificate"), []))
    findings = cross_document.run(ev, bidder=None)
    assert any(f.finding_type == "duplicate_document_type" for f in findings)


# ─────────────────────────────────────────────────────────────────────────────
# Scoring (CLAUDE.md §10)
# ─────────────────────────────────────────────────────────────────────────────
def test_score_is_a_weighted_sum_recomputable_by_hand():
    rows = [
        ("REQ-001", "a", True, True, 10.0, ComplianceStatus.COMPLIANT),
        ("REQ-002", "b", False, True, 10.0, ComplianceStatus.NEEDS_HUMAN_REVIEW),
    ]
    score = scoring.compute(rows)
    # (10*1.0 + 10*0.5) / 20 = 0.75
    assert score.value == Decimal("75.00")


def test_not_applicable_is_excluded_from_the_denominator():
    rows = [
        ("REQ-001", "a", True, True, 10.0, ComplianceStatus.COMPLIANT),
        ("REQ-002", "b", False, False, 10.0, ComplianceStatus.NOT_APPLICABLE),
    ]
    assert scoring.compute(rows).value == Decimal("100.00")


def test_a_failed_mandatory_requirement_fails_the_gate_and_is_named():
    rows = [
        ("REQ-001", "a", True, True, 10.0, ComplianceStatus.NON_COMPLIANT),
        ("REQ-002", "b", False, True, 10.0, ComplianceStatus.COMPLIANT),
    ]
    score = scoring.compute(rows)
    assert not score.mandatory_gate_passed
    assert score.mandatory_failed == ["REQ-001"]
    assert not score.qualifiable


def test_a_pending_mandatory_item_is_not_a_failure():
    """The split that makes a clean-bidder demo possible.

    NEEDS_HUMAN_REVIEW on a mandatory requirement means nobody has looked yet.
    Reporting that identically to a genuine NON_COMPLIANT tells an officer a
    compliant bidder failed.
    """
    rows = [("REQ-001", "a", True, True, 10.0, ComplianceStatus.NEEDS_HUMAN_REVIEW)]
    score = scoring.compute(rows)
    assert score.mandatory_failed == []
    assert score.pending_review == ["REQ-001"]
    assert score.mandatory_gate_passed  # nothing has *failed*
    assert not score.qualifiable  # but it is not ready to qualify either


def test_missing_mandatory_evidence_is_pending_not_failed():
    """§2 rule 5: absent documentation routes to clarification, not rejection."""
    rows = [("REQ-001", "a", True, True, 10.0, ComplianceStatus.MISSING_EVIDENCE)]
    score = scoring.compute(rows)
    assert score.mandatory_failed == []
    assert score.pending_review == ["REQ-001"]


@pytest.mark.parametrize(
    "status",
    [ComplianceStatus.NON_COMPLIANT, ComplianceStatus.EXPIRED, ComplianceStatus.INCONSISTENT],
)
def test_evidence_found_and_wanting_is_a_hard_failure(status):
    rows = [("REQ-001", "a", True, True, 10.0, status)]
    assert scoring.compute(rows).mandatory_failed == ["REQ-001"]


def test_an_officer_override_is_what_the_gate_counts():
    """The machine verdict is kept; the override is what the gate reads (§5)."""
    from app.modules.compliance_engine.scoring import effective_status

    assert effective_status(ComplianceStatus.NEEDS_HUMAN_REVIEW, None) is (
        ComplianceStatus.NEEDS_HUMAN_REVIEW
    )
    assert (
        effective_status(ComplianceStatus.NEEDS_HUMAN_REVIEW, ComplianceStatus.COMPLIANT)
        is ComplianceStatus.COMPLIANT
    )

    rows = [
        (
            "REQ-001",
            "a",
            True,
            True,
            10.0,
            effective_status(ComplianceStatus.NEEDS_HUMAN_REVIEW, ComplianceStatus.COMPLIANT),
        )
    ]
    assert scoring.compute(rows).qualifiable


def test_an_unweighted_mandatory_failure_still_moves_the_score():
    """Otherwise a bidder could fail a statutory check and still score 100."""
    rows = [
        ("REQ-001", "a", True, True, 0.0, ComplianceStatus.MISSING_EVIDENCE),
        ("REQ-002", "b", False, True, 0.0, ComplianceStatus.COMPLIANT),
    ]
    assert scoring.compute(rows).value == Decimal("50.00")


def test_missing_evidence_and_non_compliant_score_the_same_zero_but_differ_in_state():
    for status in (ComplianceStatus.MISSING_EVIDENCE, ComplianceStatus.NON_COMPLIANT):
        rows = [("REQ-001", "a", False, True, 10.0, status)]
        assert scoring.compute(rows).value == Decimal("0.00")


def test_unverified_scores_as_a_half_not_a_zero():
    """A check that could not run is not evidence of failure (CLAUDE.md §8)."""
    rows = [("REQ-001", "a", False, True, 10.0, ComplianceStatus.UNVERIFIED)]
    assert scoring.compute(rows).value == Decimal("50.00")


def test_the_breakdown_shows_every_contribution():
    rows = [("REQ-001", "a", True, True, 10.0, ComplianceStatus.COMPLIANT)]
    entry = scoring.compute(rows).breakdown[0]
    assert entry["weight"] == 10.0 and entry["value"] == 1.0 and entry["contribution"] == 10.0


# ─────────────────────────────────────────────────────────────────────────────
# Risk (CLAUDE.md §10) — a different question from the score
# ─────────────────────────────────────────────────────────────────────────────
def _assess(**kw):
    from app.modules.risk_engine.service import assess

    base = dict(evidence=index(), findings=[], verdicts=[], bid_due_date=DUE)
    base.update(kw)
    return assess(**base)


def test_a_clean_bidder_is_low_risk():
    assert _assess().level is RiskLevel.LOW


def test_any_critical_finding_makes_the_bidder_critical_risk():
    gst, pan = seg("gst_certificate"), seg("pan_card")
    ev = index(
        (gst, [fld(gst, "gstin", "33AABCA1234C1ZM")]), (pan, [fld(pan, "pan", "AABCB9999B")])
    )
    findings = cross_document.run(ev, bidder=None)
    assert _assess(evidence=ev, findings=findings).level is RiskLevel.CRITICAL


def test_a_recently_incorporated_company_is_flagged():
    s = seg("incorporation_certificate")
    ev = index((s, [fld(s, "incorporation_date", "01/03/2026")]))
    assessment = _assess(evidence=ev)
    assert any(f.code == "recently_incorporated" for f in assessment.flags)


def test_risk_is_independent_of_the_compliance_score():
    """A bidder can meet every requirement and still be high risk."""
    s = seg("incorporation_certificate")
    ev = index((s, [fld(s, "incorporation_date", "01/03/2026")]))
    assessment = _assess(evidence=ev)
    assert assessment.level is not RiskLevel.LOW
    assert scoring.compute(
        [("REQ-001", "a", True, True, 10.0, ComplianceStatus.COMPLIANT)]
    ).value == Decimal("100.00")


def test_every_assessment_states_which_flags_fired():
    s = seg("incorporation_certificate")
    ev = index((s, [fld(s, "incorporation_date", "01/03/2026")]))
    assert "signal(s) fired" in _assess(evidence=ev).rationale


# ─────────────────────────────────────────────────────────────────────────────
# Evidence attribution — Bidder C's holding-company case (CLAUDE.md §16)
# ─────────────────────────────────────────────────────────────────────────────
def _turnover_requirement():
    return req(
        accepts_document_types=["ca_turnover_certificate"],
        condition={
            "field": "average_annual_turnover",
            "operator": ">=",
            "threshold": 1000000000,
            "period_years": 3,
        },
    )


def _turnover_evidence(entity: str):
    s = seg("ca_turnover_certificate")
    return index(
        (
            s,
            [
                fld(s, "legal_name", entity),
                fld(s, "turnover_fy1", "Rs. 3,60,00,00,000"),
                fld(s, "turnover_fy2", "Rs. 3,40,00,00,000"),
                fld(s, "turnover_fy3", "Rs. 3,20,00,00,000"),
            ],
        )
    )


def test_turnover_belonging_to_the_bidder_is_compliant():
    verdict = engine.evaluate(
        _turnover_requirement(),
        _turnover_evidence("Coastal Marine Works Private Limited"),
        DUE,
        PROVIDER,
        bidder_name="Coastal Marine Works Private Limited",
    )
    assert verdict.status is ComplianceStatus.COMPLIANT


def test_turnover_belonging_to_the_holding_company_goes_to_the_officer():
    """The figure clears the threshold four times over — on someone else's money.

    Nothing upstream objects: the arithmetic is right and the certificate is
    genuine. A silent COMPLIANT here would answer a question the tender never
    asked.
    """
    verdict = engine.evaluate(
        _turnover_requirement(),
        _turnover_evidence("Coastal Holdings Limited"),
        DUE,
        PROVIDER,
        bidder_name="Coastal Marine Works Private Limited",
    )
    assert verdict.status is ComplianceStatus.NEEDS_HUMAN_REVIEW
    assert "Coastal Holdings Limited" in verdict.reasoning
    assert "not the bidding entity" in verdict.reasoning


def test_attribution_does_not_fail_the_requirement():
    """It is a judgement call, not a shortfall. Real tenders permit this."""
    verdict = engine.evaluate(
        _turnover_requirement(),
        _turnover_evidence("Coastal Holdings Limited"),
        DUE,
        PROVIDER,
        bidder_name="Coastal Marine Works Private Limited",
    )
    assert verdict.status is not ComplianceStatus.NON_COMPLIANT


def test_a_spelling_variant_of_the_bidders_own_name_still_passes():
    """Normalisation runs first, so 'Pvt Ltd' against 'Private Limited' is fine."""
    verdict = engine.evaluate(
        _turnover_requirement(),
        _turnover_evidence("Coastal Marine Works Pvt Ltd"),
        DUE,
        PROVIDER,
        bidder_name="Coastal Marine Works Private Limited",
    )
    assert verdict.status is ComplianceStatus.COMPLIANT


def test_attribution_never_upgrades_a_failing_verdict():
    """It can only route a pass to review; it cannot rescue a shortfall."""
    s = seg("ca_turnover_certificate")
    ev = index(
        (
            s,
            [
                fld(s, "legal_name", "ABC Engineers Private Limited"),
                fld(s, "turnover_fy1", "Rs. 65,00,00,000"),
                fld(s, "turnover_fy2", "Rs. 62,00,00,000"),
                fld(s, "turnover_fy3", "Rs. 59,00,00,000"),
            ],
        )
    )
    verdict = engine.evaluate(
        _turnover_requirement(),
        ev,
        DUE,
        PROVIDER,
        bidder_name="ABC Engineers Private Limited",
    )
    assert verdict.status is ComplianceStatus.NON_COMPLIANT


def test_without_a_bidder_name_attribution_is_skipped_rather_than_guessed():
    verdict = engine.evaluate(
        _turnover_requirement(),
        _turnover_evidence("Someone Else Entirely Limited"),
        DUE,
        PROVIDER,
        bidder_name=None,
    )
    assert verdict.status is ComplianceStatus.COMPLIANT


# ─────────────────────────────────────────────────────────────────────────────
# Cross-document comparison across entities (CLAUDE.md §9, §20)
# ─────────────────────────────────────────────────────────────────────────────
def _bidder(name: str):
    from types import SimpleNamespace

    return SimpleNamespace(legal_name=name)


def test_a_different_companys_document_is_not_a_contradiction():
    """Bidder C: the holding company's certificate names the holding company.

    §20 states this rule for consortium members — consistency is checked within
    each member's own documents, because getting it backwards "would flag every
    consortium as fraudulent". A parent company is the same situation.
    """
    own, holding = seg("pan_card"), seg("ca_turnover_certificate")
    ev = index(
        (
            own,
            [
                fld(own, "pan", "AADCC3344M"),
                fld(own, "legal_name", "Coastal Marine Works Private Limited"),
            ],
        ),
        (
            holding,
            [
                fld(holding, "pan", "AAACH7788P"),
                fld(holding, "legal_name", "Coastal Holdings Limited"),
            ],
        ),
    )
    findings = cross_document.run(ev, _bidder("Coastal Marine Works Private Limited"))

    assert not any(f.finding_type == "pan_mismatch" for f in findings)
    notice = next(f for f in findings if f.finding_type == "evidence_from_another_entity")
    assert "Coastal Holdings Limited" in notice.description
    # A judgement for the officer, not an accusation.
    assert notice.severity is Severity.HIGH


def test_a_near_match_name_stays_the_bidders_own_document():
    """Bidder B: 'ABC Engineering Pvt Ltd' on the card, 'ABC Engineers' registered.

    Close but not identical is the middle case of §9 — the bidder's own
    paperwork, inconsistently filled in. Its values must still be compared, or
    the GSTIN/PAN check never runs on them.
    """
    card, gst = seg("pan_card"), seg("gst_certificate")
    ev = index(
        (
            card,
            [fld(card, "pan", "AABCE5678K"), fld(card, "legal_name", "ABC Engineering Pvt Ltd")],
        ),
        (
            gst,
            [
                fld(gst, "gstin", "33AABCE9999K1ZX"),
                fld(gst, "legal_name", "ABC Engineers Private Limited"),
            ],
        ),
    )
    findings = cross_document.run(ev, _bidder("ABC Engineers Private Limited"))

    assert any(f.finding_type == "legal_name_variance" for f in findings)
    assert not any(f.finding_type == "evidence_from_another_entity" for f in findings)
    # The card was kept in scope, so the embedded-PAN check still fired.
    assert any(f.finding_type == "gstin_pan_mismatch" for f in findings)


def test_the_same_difference_is_reported_once():
    """One name, appearing in five documents, is one problem — not five."""
    segments = [seg("pan_card"), seg("gst_certificate"), seg("iso_certificate")]
    pairs = [(s, [fld(s, "legal_name", "ABC Engineering Pvt Ltd")]) for s in segments]
    findings = cross_document.run(index(*pairs), _bidder("ABC Engineers Private Limited"))
    variances = [f for f in findings if f.finding_type == "legal_name_variance"]
    assert len(variances) == 1


def test_an_outside_entitys_document_does_not_fail_the_consistency_requirement():
    """It routes to the officer. Turning a judgement call into a hard failure
    would make Bidder C look fraudulent rather than ambiguous."""
    assert "evidence_from_another_entity" not in cross_document.CONTRADICTION_TYPES
    assert "gstin_pan_mismatch" in cross_document.CONTRADICTION_TYPES
