"""Unit tests for the deterministic rule engine (CLAUDE.md §9, §13).

No database, no network, no model. These are the checks that must be defensible
line by line in an audit, so each gets a passing case, a failing case, and the
boundary between them.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.modules.compliance_engine import rules as r

DUE = date(2026, 9, 15)


# ─────────────────────────────────────────────────────────────────────────────
# A RuleOutcome must never be used as a boolean
# ─────────────────────────────────────────────────────────────────────────────
def test_outcome_refuses_to_be_truthy():
    """`if check_pan_format(x):` would be true even for a failure. Refuse it."""
    outcome = r.check_pan_format("AABCA1234C")
    with pytest.raises(TypeError):
        bool(outcome)


def test_every_outcome_explains_itself():
    assert r.check_pan_format("BAD").detail
    assert r.check_gstin_contains_pan("33AABCA1234C1ZM", "AABCA1234C").detail


# ─────────────────────────────────────────────────────────────────────────────
# PAN
# ─────────────────────────────────────────────────────────────────────────────
def test_pan_format_accepts_a_valid_pan():
    assert r.check_pan_format("AABCA1234C").passed


@pytest.mark.parametrize(
    "bad",
    ["AABCA1234", "AABCA12345", "AABC1234C", "aabca1234c1", "", None, "AABCA1234CC"],
)
def test_pan_format_rejects_malformed_input(bad):
    assert not r.check_pan_format(bad).passed


def test_pan_format_tolerates_surrounding_whitespace_and_case():
    assert r.check_pan_format("  aabca1234c ").passed


def test_pan_holder_type_accepts_a_company_pan():
    outcome = r.check_pan_holder_type("AABCA1234C", "company")
    assert outcome.passed
    assert "C" in (outcome.observed or "")


def test_pan_holder_type_flags_an_individual_pan_on_a_company_bid():
    """CLAUDE.md §9: a company whose PAN has P in position 4 is a flag."""
    outcome = r.check_pan_holder_type("AABPA1234C", "company")
    assert not outcome.passed
    assert "individual" in outcome.detail


def test_pan_holder_type_cannot_be_read_from_a_malformed_pan():
    assert not r.check_pan_holder_type("NOPE", "company").passed


# ─────────────────────────────────────────────────────────────────────────────
# GSTIN
# ─────────────────────────────────────────────────────────────────────────────
def test_gstin_structure_accepts_a_correctly_computed_gstin():
    assert r.check_gstin_structure("33AABCA1234C1ZM").passed


def test_gstin_structure_rejects_a_wrong_check_character():
    """The boundary case: right shape, wrong final character."""
    outcome = r.check_gstin_structure("33AABCA1234C1ZA")
    assert not outcome.passed
    assert outcome.working["computed_check_character"] == "M"


@pytest.mark.parametrize("bad", ["33AABCA1234C1Z", "", None, "33AABCA1234C1XM"])
def test_gstin_structure_rejects_malformed_input(bad):
    assert not r.check_gstin_structure(bad).passed


def test_check_character_computation_is_reversible():
    assert r.gstin_check_character("33AABCA1234C1Z") == "M"


# ── The highest-value check in the system ────────────────────────────────────
def test_gstin_embeds_the_matching_pan():
    outcome = r.check_gstin_contains_pan("33AABCA1234C1ZM", "AABCA1234C")
    assert outcome.passed
    assert outcome.working["embedded_pan"] == "AABCA1234C"


def test_gstin_embedding_a_different_pan_is_caught():
    """Bidder B's planted failure: the GSTIN and the PAN card disagree."""
    outcome = r.check_gstin_contains_pan("33AABCA1234C1ZM", "AABCB9999B")
    assert not outcome.passed
    assert "AABCA1234C" in outcome.detail and "AABCB9999B" in outcome.detail


def test_gstin_pan_comparison_refuses_to_compare_malformed_input():
    outcome = r.check_gstin_contains_pan("not-a-gstin", "AABCA1234C")
    assert not outcome.passed
    assert "malformed" in outcome.detail.lower()


# ─────────────────────────────────────────────────────────────────────────────
# Udyam and CIN
# ─────────────────────────────────────────────────────────────────────────────
def test_udyam_format_accepts_a_valid_urn():
    assert r.check_udyam_format("UDYAM-TN-33-0041827").passed


def test_udyam_state_code_is_cross_checked_against_the_address():
    outcome = r.check_udyam_format("UDYAM-TN-33-0041827", state_code="27")
    assert not outcome.passed
    assert "state" in outcome.detail


def test_udyam_format_rejects_a_wrong_shape():
    assert not r.check_udyam_format("UDYAM-TN-3-41827").passed


def test_cin_year_must_match_the_incorporation_certificate():
    good = r.check_cin_structure("U45200TN2015PTC101234", date(2015, 3, 18))
    assert good.passed
    bad = r.check_cin_structure("U45200TN2015PTC101234", date(2019, 3, 18))
    assert not bad.passed
    assert "2015" in bad.detail and "2019" in bad.detail


def test_cin_structure_rejects_a_wrong_length():
    assert not r.check_cin_structure("U45200TN2015PTC").passed


# ─────────────────────────────────────────────────────────────────────────────
# Turnover averaging
# ─────────────────────────────────────────────────────────────────────────────
def test_average_turnover_computes_the_mean():
    outcome = r.average_turnover(
        [Decimal("1000000000"), Decimal("1200000000"), Decimal("1100000000")], required_years=3
    )
    assert outcome.passed
    assert Decimal(outcome.working["mean"]) == Decimal("1100000000")


def test_average_turnover_refuses_an_incomplete_series():
    """A three-year average from two years is not a three-year average."""
    outcome = r.average_turnover([Decimal("1000000000"), Decimal("1200000000")], required_years=3)
    assert not outcome.passed
    assert "only 2" in outcome.detail


def test_average_turnover_with_no_figures_at_all():
    assert not r.average_turnover([None, None], required_years=3).passed


def test_average_turnover_uses_only_the_years_required():
    outcome = r.average_turnover(
        [Decimal("300"), Decimal("300"), Decimal("300"), Decimal("0")], required_years=3
    )
    assert Decimal(outcome.working["mean"]) == Decimal("300")


def test_parse_amount_reads_indian_digit_grouping():
    assert r.parse_amount("Rs. 47,50,00,000") == Decimal("475000000")


def test_parse_amount_returns_none_rather_than_guessing():
    assert r.parse_amount("not stated") is None
    assert r.parse_amount(None) is None


# ─────────────────────────────────────────────────────────────────────────────
# Threshold comparison
# ─────────────────────────────────────────────────────────────────────────────
def test_threshold_passes_when_met():
    assert r.compare_threshold(Decimal("1100000000"), ">=", 1000000000).passed


def test_threshold_fails_and_states_the_shortfall():
    """Bidder B's turnover shortfall: 62 Cr against 100 Cr required."""
    outcome = r.compare_threshold(Decimal("620000000"), ">=", 1000000000)
    assert not outcome.passed
    assert "380,000,000" in outcome.detail


def test_threshold_boundary_is_inclusive_for_greater_or_equal():
    assert r.compare_threshold(Decimal("1000000000"), ">=", 1000000000).passed
    assert not r.compare_threshold(Decimal("999999999"), ">=", 1000000000).passed


def test_threshold_without_a_value_does_not_pass():
    assert not r.compare_threshold(None, ">=", 100).passed


def test_unsupported_operator_is_an_error_not_a_silent_pass():
    with pytest.raises(ValueError):
        r.compare_threshold(Decimal("1"), "~=", 1)


# ─────────────────────────────────────────────────────────────────────────────
# Dates, measured against the bid due date
# ─────────────────────────────────────────────────────────────────────────────
def test_certificate_valid_after_the_due_date_passes():
    assert r.check_not_expired(date(2026, 12, 31), DUE).passed


def test_certificate_expired_before_the_due_date_fails():
    outcome = r.check_not_expired(date(2026, 8, 1), DUE)
    assert not outcome.passed
    assert "45 day(s) before" in outcome.detail


def test_validity_boundary_is_the_due_date_itself():
    """Valid *on* the due date counts. One day earlier does not."""
    assert r.check_not_expired(DUE, DUE).passed
    assert not r.check_not_expired(date(2026, 9, 14), DUE).passed


def test_bidder_a_near_miss_is_a_pass_that_reports_its_margin():
    """§16: a certificate expiring days after the bid due date is not a failure."""
    outcome = r.check_not_expired(date(2026, 9, 18), DUE)
    assert outcome.passed
    assert outcome.working["days_remaining_at_due_date"] == 3


def test_expiry_is_measured_against_the_due_date_not_today():
    """A certificate long expired today, but valid at bid time, passes."""
    outcome = r.check_not_expired(date(2026, 9, 20), date(2026, 9, 15))
    assert outcome.passed


def test_missing_validity_date_does_not_pass():
    assert not r.check_not_expired(None, DUE).passed


def test_minimum_age_uses_the_due_date():
    assert r.check_minimum_age(date(2015, 3, 18), DUE, 5).passed
    assert not r.check_minimum_age(date(2024, 3, 18), DUE, 5).passed


def test_minimum_age_boundary():
    """Just over five years passes; just under does not."""
    assert r.check_minimum_age(date(2021, 9, 14), DUE, 5).passed
    assert not r.check_minimum_age(date(2021, 9, 16), DUE, 5).passed


def test_within_period_accepts_recent_work_and_rejects_old_work():
    assert r.check_within_period(date(2023, 11, 22), DUE, 7).passed
    assert not r.check_within_period(date(2015, 1, 1), DUE, 7).passed


def test_within_period_rejects_a_future_date():
    """A completion certificate dated after the bid closes is not evidence."""
    assert not r.check_within_period(date(2027, 1, 1), DUE, 7).passed


# ─────────────────────────────────────────────────────────────────────────────
# Legal name comparison
# ─────────────────────────────────────────────────────────────────────────────
def test_normalisation_strips_suffixes_honorifics_and_punctuation():
    value, steps = r.normalize_legal_name("M/s ABC Infrastructure Private Limited")
    assert value == "abc infrastructure"
    assert any("honorific" in s for s in steps)
    assert any("legal suffix" in s for s in steps)


def test_the_same_company_written_two_ways_matches():
    outcome = r.compare_legal_names(
        "ABC Infrastructure Private Limited", "ABC Infrastructure Pvt Ltd"
    )
    assert outcome.passed
    assert outcome.working["similarity"] == 1.0


def test_a_near_match_is_referred_to_a_human_not_resolved():
    """Bidder B: 'ABC Engineering' against 'ABC Engineers' (CLAUDE.md §9)."""
    outcome = r.compare_legal_names("ABC Engineering Pvt Ltd", "ABC Engineers Private Limited")
    assert not outcome.passed
    assert outcome.working["needs_human"] is True
    assert "human" in outcome.detail


def test_clearly_different_companies_do_not_match():
    outcome = r.compare_legal_names("ABC Infrastructure Pvt Ltd", "Zenith Marine Services Ltd")
    assert not outcome.passed
    assert outcome.working["needs_human"] is False


def test_name_comparison_always_shows_its_working():
    outcome = r.compare_legal_names("M/s ABC Infra Ltd", "ABC Infrastructure Limited")
    assert outcome.working["left_steps"] and outcome.working["right_steps"]
    assert "similarity" in outcome.working


def test_a_missing_name_is_not_a_match():
    assert not r.compare_legal_names(None, "ABC Ltd").passed


# ─────────────────────────────────────────────────────────────────────────────
# Identifiers are compared exactly, never fuzzily
# ─────────────────────────────────────────────────────────────────────────────
def test_identifiers_match_only_when_identical():
    assert r.check_exact_identifier("AABCA1234C", "aabca1234c", "pan").passed
    assert not r.check_exact_identifier("AABCA1234C", "AABCA1234D", "pan").passed


def test_a_missing_identifier_is_never_a_match():
    assert not r.check_exact_identifier(None, "AABCA1234C", "pan").passed
    assert not r.check_exact_identifier("", "", "pan").passed
