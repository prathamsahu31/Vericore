"""Deterministic checks. CLAUDE.md §9.

Nothing here calls a model. These are the parts of the system that must be
correct line by line under audit, so every one of them is a pure function over
values the extraction layer already produced, and every one returns an
explanation rather than a bare boolean — a mismatch an officer cannot interrogate
is a mismatch they cannot defend (§9).

The LLM is forbidden from doing any of this: arithmetic, date comparison,
threshold evaluation and ID matching all live here (§7.5).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

from rapidfuzz import fuzz

# ─────────────────────────────────────────────────────────────────────────────
# Result type
# ─────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class RuleOutcome:
    """The verdict of one deterministic check, with its working shown."""

    rule: str
    passed: bool
    detail: str
    observed: str | None = None
    expected: str | None = None
    working: dict = field(default_factory=dict)

    def __bool__(self) -> bool:  # pragma: no cover - guards accidental truthiness
        raise TypeError(
            "RuleOutcome is not a boolean. Read .passed, and show .detail to the officer."
        )


# ─────────────────────────────────────────────────────────────────────────────
# Structural identifier checks — zero false positives
# ─────────────────────────────────────────────────────────────────────────────

PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
GSTIN_RE = re.compile(r"^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")
UDYAM_RE = re.compile(r"^UDYAM-([A-Z]{2})-([0-9]{2})-([0-9]{7})$")
CIN_RE = re.compile(r"^[LU][0-9]{5}[A-Z]{2}([0-9]{4})[A-Z]{3}[0-9]{6}$")

# The 4th character of a PAN encodes the holder type.
PAN_HOLDER_TYPES = {
    "C": "company",
    "P": "individual",
    "H": "hindu_undivided_family",
    "F": "firm",
    "A": "association_of_persons",
    "T": "trust",
    "B": "body_of_individuals",
    "L": "local_authority",
    "J": "artificial_juridical_person",
    "G": "government",
}

_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _clean(value: str | None) -> str:
    return (value or "").strip().replace(" ", "").upper()


def gstin_check_character(first14: str) -> str:
    """The 15th character, by the standard mod-36 weighting."""
    total = 0
    for i, ch in enumerate(first14):
        product = _ALPHABET.index(ch) * (2 if i % 2 else 1)
        total += product // 36 + product % 36
    return _ALPHABET[(36 - total % 36) % 36]


def check_pan_format(pan: str | None) -> RuleOutcome:
    """Five letters, four digits, one letter."""
    value = _clean(pan)
    ok = bool(PAN_RE.match(value))
    return RuleOutcome(
        rule="pan_format",
        passed=ok,
        detail=(
            f"PAN {value} is well-formed."
            if ok
            else f"PAN {value or '(absent)'} does not match the required pattern "
            f"AAAAA9999A (five letters, four digits, one letter)."
        ),
        observed=value or None,
        expected="[A-Z]{5}[0-9]{4}[A-Z]",
    )


def check_pan_holder_type(pan: str | None, expected_type: str = "company") -> RuleOutcome:
    """The 4th character must match the kind of entity the bidder claims to be.

    A bidder presenting itself as a company whose PAN carries ``P`` in position
    four has submitted something inconsistent with its own claim (CLAUDE.md §9).
    """
    value = _clean(pan)
    if not PAN_RE.match(value):
        return RuleOutcome(
            rule="pan_holder_type",
            passed=False,
            detail="Holder type cannot be read from a malformed PAN.",
            observed=value or None,
        )
    code = value[3]
    actual = PAN_HOLDER_TYPES.get(code, "unknown")
    ok = actual == expected_type
    return RuleOutcome(
        rule="pan_holder_type",
        passed=ok,
        detail=(
            f"PAN character 4 is '{code}', denoting a {actual.replace('_', ' ')}, "
            f"which matches the declared entity type."
            if ok
            else f"PAN character 4 is '{code}', denoting a {actual.replace('_', ' ')}, "
            f"but the bidder is presented as a {expected_type.replace('_', ' ')}."
        ),
        observed=f"{code} ({actual})",
        expected=expected_type,
        working={"position": 4, "character": code},
    )


def check_gstin_structure(gstin: str | None) -> RuleOutcome:
    """Fifteen characters, correct shape, and a valid final check character."""
    value = _clean(gstin)
    if not GSTIN_RE.match(value):
        return RuleOutcome(
            rule="gstin_structure",
            passed=False,
            detail=(
                f"GSTIN {value or '(absent)'} is not a valid 15-character GSTIN: "
                f"expected two state digits, a ten-character PAN, an entity digit, "
                f"the letter Z, and a check character."
            ),
            observed=value or None,
            expected="15 characters, NNPPPPPPPPPPEZC",
        )
    expected_check = gstin_check_character(value[:14])
    ok = value[14] == expected_check
    return RuleOutcome(
        rule="gstin_structure",
        passed=ok,
        detail=(
            f"GSTIN {value} is well-formed and its check character is correct."
            if ok
            else f"GSTIN {value} has check character '{value[14]}' but the first "
            f"fourteen characters compute to '{expected_check}'."
        ),
        observed=value,
        expected=f"check character {expected_check}",
        working={"computed_check_character": expected_check},
    )


def check_gstin_contains_pan(gstin: str | None, pan: str | None) -> RuleOutcome:
    """Characters 3–12 of a GSTIN *are* the PAN.

    The single highest-value check in the system (CLAUDE.md §9). Free, instant,
    fully explainable, and there is no innocent explanation for a mismatch —
    the PAN is not merely related to the GSTIN, it is embedded in it.
    """
    g, p = _clean(gstin), _clean(pan)
    if not GSTIN_RE.match(g) or not PAN_RE.match(p):
        return RuleOutcome(
            rule="gstin_contains_pan",
            passed=False,
            detail=(
                "Cannot compare: "
                + ("GSTIN is malformed. " if not GSTIN_RE.match(g) else "")
                + ("PAN is malformed." if not PAN_RE.match(p) else "")
            ).strip(),
            observed=f"gstin={g or '(absent)'} pan={p or '(absent)'}",
        )
    embedded = g[2:12]
    ok = embedded == p
    return RuleOutcome(
        rule="gstin_contains_pan",
        passed=ok,
        detail=(
            f"Characters 3-12 of the GSTIN ({embedded}) match the submitted PAN."
            if ok
            else f"Characters 3-12 of the GSTIN are {embedded}, but the submitted "
            f"PAN is {p}. A GSTIN embeds its holder's PAN, so these cannot "
            f"both be correct."
        ),
        observed=embedded,
        expected=p,
        working={"gstin": g, "pan": p, "embedded_pan": embedded},
    )


def check_udyam_format(urn: str | None, state_code: str | None = None) -> RuleOutcome:
    """``UDYAM-XX-00-0000000``, with the state code cross-checked if supplied."""
    value = _clean(urn)
    match = UDYAM_RE.match(value)
    if not match:
        return RuleOutcome(
            rule="udyam_format",
            passed=False,
            detail=f"Udyam number {value or '(absent)'} does not match UDYAM-XX-00-0000000.",
            observed=value or None,
            expected="UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}",
        )
    embedded_state = match.group(2)
    if state_code and embedded_state != _clean(state_code):
        return RuleOutcome(
            rule="udyam_format",
            passed=False,
            detail=(
                f"Udyam number {value} carries state code {embedded_state}, but the "
                f"registered address is in state {state_code}."
            ),
            observed=embedded_state,
            expected=state_code,
        )
    return RuleOutcome(
        rule="udyam_format",
        passed=True,
        detail=f"Udyam number {value} is well-formed.",
        observed=value,
    )


def check_cin_structure(cin: str | None, incorporation_date: date | None = None) -> RuleOutcome:
    """Twenty-one characters, with the embedded year matching incorporation."""
    value = _clean(cin)
    match = CIN_RE.match(value)
    if not match:
        return RuleOutcome(
            rule="cin_structure",
            passed=False,
            detail=f"CIN {value or '(absent)'} is not a valid 21-character CIN.",
            observed=value or None,
            expected="21 characters",
        )
    embedded_year = int(match.group(1))
    if incorporation_date and embedded_year != incorporation_date.year:
        return RuleOutcome(
            rule="cin_structure",
            passed=False,
            detail=(
                f"CIN {value} encodes year of incorporation {embedded_year}, but the "
                f"incorporation certificate is dated {incorporation_date.isoformat()}."
            ),
            observed=str(embedded_year),
            expected=str(incorporation_date.year),
        )
    return RuleOutcome(
        rule="cin_structure",
        passed=True,
        detail=f"CIN {value} is well-formed and its embedded year is consistent.",
        observed=value,
        working={"embedded_year": embedded_year},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Comparative checks — arithmetic and dates
# ─────────────────────────────────────────────────────────────────────────────

_NUMERIC = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")


def parse_amount(text: str | None) -> Decimal | None:
    """Read a rupee figure out of text like ``Rs. 47,50,00,000``.

    Returns None rather than a guess when nothing numeric is present: a
    threshold compared against a guessed figure is worse than no comparison.
    """
    if text is None:
        return None
    match = _NUMERIC.search(str(text))
    if not match:
        return None
    try:
        return Decimal(match.group(0).replace(",", ""))
    except InvalidOperation:
        return None


def average_turnover(
    values: list[Decimal | None], required_years: int | None = None
) -> RuleOutcome:
    """Mean turnover over the financial years supplied.

    Refuses to average an incomplete series. A three-year average computed from
    two years is not a three-year average, and quietly producing one would put a
    number in front of an officer that the tender never asked for.
    """
    present = [v for v in values if v is not None]
    if not present:
        return RuleOutcome(
            rule="average_turnover",
            passed=False,
            detail="No turnover figures could be read.",
            working={"years_found": 0},
        )
    if required_years is not None and len(present) < required_years:
        return RuleOutcome(
            rule="average_turnover",
            passed=False,
            detail=(
                f"The tender requires an average over {required_years} financial years, "
                f"but only {len(present)} could be read."
            ),
            observed=f"{len(present)} years",
            expected=f"{required_years} years",
            working={"years_found": len(present), "values": [str(v) for v in present]},
        )
    used = present[:required_years] if required_years else present
    mean = sum(used) / Decimal(len(used))
    return RuleOutcome(
        rule="average_turnover",
        passed=True,
        detail=(
            f"Average of {len(used)} financial years "
            f"({', '.join(f'{v:,.0f}' for v in used)}) is {mean:,.2f}."
        ),
        observed=f"{mean:,.2f}",
        working={"values": [str(v) for v in used], "mean": str(mean), "years": len(used)},
    )


_OPERATORS = {
    ">=": lambda a, b: a >= b,
    ">": lambda a, b: a > b,
    "<=": lambda a, b: a <= b,
    "<": lambda a, b: a < b,
    "==": lambda a, b: a == b,
}


def compare_threshold(
    value: Decimal | None, operator: str, threshold: Decimal | int, unit: str = ""
) -> RuleOutcome:
    """Compare a figure to the tender's threshold. Arithmetic, never a model."""
    if value is None:
        return RuleOutcome(
            rule="threshold",
            passed=False,
            detail="No value was available to compare against the threshold.",
            expected=f"{operator} {threshold:,}",
        )
    if operator not in _OPERATORS:
        raise ValueError(f"Unsupported operator {operator!r}")

    threshold = Decimal(threshold)
    ok = _OPERATORS[operator](value, threshold)
    suffix = f" {unit}" if unit and unit != "INR" else ""
    return RuleOutcome(
        rule="threshold",
        passed=ok,
        detail=(
            f"{value:,.0f}{suffix} {operator} {threshold:,.0f}{suffix} — requirement met."
            if ok
            else f"{value:,.0f}{suffix} fails {operator} {threshold:,.0f}{suffix}. "
            f"Shortfall of {abs(threshold - value):,.0f}{suffix}."
        ),
        observed=f"{value:,.0f}{suffix}",
        expected=f"{operator} {threshold:,.0f}{suffix}",
        working={"value": str(value), "operator": operator, "threshold": str(threshold)},
    )


def check_not_expired(valid_until: date | None, bid_due_date: date) -> RuleOutcome:
    """Validity is measured against the bid due date, never against today.

    A certificate that lapses next week was valid on the day the bid was
    submitted, and evaluating it against today's date would fail a bidder for
    the passage of time during evaluation (CLAUDE.md §9).
    """
    if valid_until is None:
        return RuleOutcome(
            rule="not_expired",
            passed=False,
            detail="No validity date could be read from the certificate.",
            expected=f"valid on or after {bid_due_date.isoformat()}",
        )
    ok = valid_until >= bid_due_date
    days = (valid_until - bid_due_date).days
    return RuleOutcome(
        rule="not_expired",
        passed=ok,
        detail=(
            f"Valid until {valid_until.isoformat()}, which is {days} day(s) after the "
            f"bid due date of {bid_due_date.isoformat()}."
            if ok
            else f"Expired on {valid_until.isoformat()}, {abs(days)} day(s) before the "
            f"bid due date of {bid_due_date.isoformat()}."
        ),
        observed=valid_until.isoformat(),
        expected=f">= {bid_due_date.isoformat()}",
        working={"days_remaining_at_due_date": days},
    )


def check_minimum_age(
    start_date: date | None, bid_due_date: date, minimum_years: int
) -> RuleOutcome:
    """ "N years continuous operation" measured to the bid due date."""
    if start_date is None:
        return RuleOutcome(
            rule="minimum_age",
            passed=False,
            detail="No incorporation date could be read.",
            expected=f">= {minimum_years} years",
        )
    years = (bid_due_date - start_date).days / 365.25
    ok = years >= minimum_years
    return RuleOutcome(
        rule="minimum_age",
        passed=ok,
        detail=(
            f"Incorporated {start_date.isoformat()}, {years:.1f} years before the bid "
            f"due date; the tender requires {minimum_years}."
        ),
        observed=f"{years:.1f} years",
        expected=f">= {minimum_years} years",
        working={"years": round(years, 2), "from": start_date.isoformat()},
    )


def check_within_period(
    event_date: date | None, bid_due_date: date, within_years: int
) -> RuleOutcome:
    """Whether something happened recently enough to count."""
    if event_date is None:
        return RuleOutcome(
            rule="within_period",
            passed=False,
            detail="No date could be read for this item.",
            expected=f"within {within_years} years of {bid_due_date.isoformat()}",
        )
    years = (bid_due_date - event_date).days / 365.25
    ok = 0 <= years <= within_years
    return RuleOutcome(
        rule="within_period",
        passed=ok,
        detail=(
            f"Dated {event_date.isoformat()}, {years:.1f} years before the bid due "
            f"date; the tender allows {within_years}."
        ),
        observed=event_date.isoformat(),
        expected=f"within {within_years} years",
        working={"years_before_due_date": round(years, 2)},
    )


# ─────────────────────────────────────────────────────────────────────────────
# Legal name comparison
# ─────────────────────────────────────────────────────────────────────────────

_LEGAL_SUFFIXES = [
    "private limited",
    "pvt limited",
    "pvt ltd",
    "(p) ltd",
    "p ltd",
    "public limited",
    "limited",
    "ltd",
    "llp",
    "& co.",
    "and co.",
    "& co",
    "and co",
]
_HONORIFICS = ["m/s.", "m/s", "messrs."]
_PUNCTUATION = re.compile(r"[.,\-_/()\[\]&']")
_SPACES = re.compile(r"\s+")

# Above this, two names are the same entity written differently.
NAME_MATCH_THRESHOLD = 0.90
# Below this, they are different entities.
NAME_DISTINCT_THRESHOLD = 0.70


def normalize_legal_name(name: str | None) -> tuple[str, list[str]]:
    """Normalise a company name, returning the value *and* the steps applied.

    The steps are shown in the evidence ledger. An officer asked to accept that
    two spellings are one company is entitled to see exactly what was folded
    away to reach that conclusion (CLAUDE.md §9, §11).
    """
    steps: list[str] = []
    value = (name or "").strip()
    if not value:
        return "", ["input was empty"]

    lowered = value.casefold()
    if lowered != value:
        steps.append("case-folded")
    value = lowered

    for honorific in _HONORIFICS:
        if value.startswith(honorific):
            value = value[len(honorific) :].strip()
            steps.append(f"removed honorific '{honorific}'")
            break

    for suffix in _LEGAL_SUFFIXES:
        if value.endswith(suffix):
            value = value[: -len(suffix)].strip()
            steps.append(f"removed legal suffix '{suffix}'")
            break

    stripped = _PUNCTUATION.sub(" ", value)
    if stripped != value:
        steps.append("removed punctuation")
    value = _SPACES.sub(" ", stripped).strip()
    steps.append("collapsed whitespace")
    return value, steps


def compare_legal_names(left: str | None, right: str | None) -> RuleOutcome:
    """Compare two company names, never as a bare boolean.

    Produces a similarity score and the normalisation steps that produced it. A
    near-match is surfaced for a human to resolve — it is never silently treated
    as a match, and never silently treated as a mismatch (CLAUDE.md §9).
    """
    left_norm, left_steps = normalize_legal_name(left)
    right_norm, right_steps = normalize_legal_name(right)

    if not left_norm or not right_norm:
        return RuleOutcome(
            rule="legal_name_match",
            passed=False,
            detail="One of the names is missing, so they cannot be compared.",
            observed=left or "(absent)",
            expected=right or "(absent)",
        )

    score = fuzz.ratio(left_norm, right_norm) / 100.0
    identical = left_norm == right_norm

    if identical:
        detail = f"'{left}' and '{right}' are identical after normalisation ('{left_norm}')."
    elif score >= NAME_MATCH_THRESHOLD:
        detail = (
            f"'{left}' and '{right}' normalise to '{left_norm}' and '{right_norm}', "
            f"a similarity of {score:.0%}. Read as the same entity written differently."
        )
    elif score >= NAME_DISTINCT_THRESHOLD:
        detail = (
            f"'{left}' and '{right}' normalise to '{left_norm}' and '{right_norm}', "
            f"a similarity of {score:.0%}. Too close to call automatically — this "
            f"needs a human to decide whether it is a variance or a different entity."
        )
    else:
        detail = (
            f"'{left}' and '{right}' normalise to '{left_norm}' and '{right_norm}', "
            f"a similarity of {score:.0%}. These read as different entities."
        )

    return RuleOutcome(
        rule="legal_name_match",
        passed=score >= NAME_MATCH_THRESHOLD,
        detail=detail,
        observed=left,
        expected=right,
        working={
            "left_normalized": left_norm,
            "right_normalized": right_norm,
            "left_steps": left_steps,
            "right_steps": right_steps,
            "similarity": round(score, 4),
            "needs_human": NAME_DISTINCT_THRESHOLD <= score < NAME_MATCH_THRESHOLD,
        },
    )


def check_exact_identifier(left: str | None, right: str | None, label: str) -> RuleOutcome:
    """Structured IDs are compared exactly. Never fuzzy-match an identifier."""
    a, b = _clean(left), _clean(right)
    ok = bool(a) and a == b
    return RuleOutcome(
        rule=f"{label}_match",
        passed=ok,
        detail=(
            f"{label.upper()} is identical across both documents ({a})."
            if ok
            else f"{label.upper()} differs: {a or '(absent)'} against {b or '(absent)'}."
        ),
        observed=a or None,
        expected=b or None,
    )
