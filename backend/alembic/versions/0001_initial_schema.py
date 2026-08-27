"""Initial schema.

Creates the seventeen tables of CLAUDE.md §6 and installs the append-only,
hash-chained audit log required by §2 rule 6.

Three things are here on day one specifically because retrofitting them would
be expensive or meaningless later:

* ``bid_members`` and ``requirements.applicability_scope`` (§20 and §23). No
  consortium logic ships yet, but a sole bid is simply a bid with one member of
  role ``sole``, so the engine never needs special-casing when consortium
  evaluation arrives on Day 4.
* ``document_segments`` (§19). Everything downstream cites a segment, never a
  file, so a page-3 citation is unambiguous about which logical document that
  page belongs to.
* The audit trigger (§2 rule 6). Tamper-evidence added after a log has been
  written is not tamper-evidence.

Every NOT NULL column that carries a Python-side default also carries the
equivalent ``server_default``. A Python default is invisible to any INSERT that
does not pass through the ORM, so without this a raw SQL insert — a backfill, a
psql session, a test fixture — fails on a column the model claims has a default.

Revision ID: 0001_initial_schema
Revises:
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

# ─────────────────────────────────────────────────────────────────────────────
# Append-only, hash-chained audit log.
#
# CLAUDE.md §2 rule 6: "Append-only audit. Enforced by a Postgres trigger, not
# by application discipline." Everything below is that enforcement. It ships in
# the first migration by design — retrofitting tamper-evidence onto a log that
# has already been written is not tamper-evidence.
# ─────────────────────────────────────────────────────────────────────────────

AUDIT_PAYLOAD_FN = """
CREATE OR REPLACE FUNCTION vericore_audit_event_payload(e audit_events)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
    -- Every field that carries meaning, joined with an ASCII unit separator so
    -- no combination of field values can imitate a different row. row_hash is
    -- deliberately excluded: it is the output, not an input.
    SELECT concat_ws(
        chr(31),
        e.id::text,
        e.seq::text,
        e.prev_hash,
        coalesce(e.tender_id::text, ''),
        coalesce(e.bid_id::text, ''),
        coalesce(e.requirement_id::text, ''),
        coalesce(e.document_id::text, ''),
        e.event_type,
        e.actor_type::text,
        coalesce(e.actor_id::text, ''),
        coalesce(e.actor_component, ''),
        coalesce(e.previous_state, ''),
        coalesce(e.new_state, ''),
        coalesce(e.reason, ''),
        -- jsonb::text is key-order normalised, so equal payloads hash equally.
        coalesce(e.payload::text, ''),
        coalesce(e.input_hash, ''),
        coalesce(e.llm_provider, ''),
        coalesce(e.llm_model_id, ''),
        coalesce(e.llm_role, ''),
        to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    );
$fn$;
"""

AUDIT_HASH_CHAIN_FN = """
CREATE OR REPLACE FUNCTION vericore_audit_events_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_prev_hash text;
BEGIN
    -- Serialise chain appends so two concurrent inserts cannot both link to
    -- the same predecessor and fork the chain. Released at transaction end.
    PERFORM pg_advisory_xact_lock(hashtext('vericore.audit_events'));

    SELECT row_hash INTO v_prev_hash
    FROM audit_events
    ORDER BY seq DESC
    LIMIT 1;

    -- The genesis link: sixty-four zeroes for the first row in the chain.
    NEW.prev_hash := coalesce(v_prev_hash, repeat('0', 64));
    NEW.row_hash := encode(
        sha256(convert_to(vericore_audit_event_payload(NEW), 'UTF8')), 'hex'
    );

    RETURN NEW;
END;
$fn$;
"""

AUDIT_APPEND_ONLY_FN = """
CREATE OR REPLACE FUNCTION vericore_audit_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only; % is not permitted', TG_OP
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'Record a correction as a new audit event. History is never rewritten.';
END;
$fn$;
"""

# Verifies both linkage and content. Because the payload function is shared with
# the insert trigger, there is no second copy of the hashing rule to drift.
AUDIT_VERIFY_FN = """
CREATE OR REPLACE FUNCTION vericore_audit_chain_verify()
RETURNS TABLE (
    seq bigint,
    id uuid,
    link_ok boolean,
    hash_ok boolean
)
LANGUAGE sql
STABLE
AS $fn$
    SELECT
        e.seq,
        e.id,
        e.prev_hash IS NOT DISTINCT FROM
            coalesce(lag(e.row_hash) OVER (ORDER BY e.seq), repeat('0', 64)) AS link_ok,
        e.row_hash = encode(
            sha256(convert_to(vericore_audit_event_payload(e), 'UTF8')), 'hex'
        ) AS hash_ok
    FROM audit_events e
    ORDER BY e.seq;
$fn$;
"""

AUDIT_TRIGGERS = """
CREATE TRIGGER audit_events_hash_chain
    BEFORE INSERT ON audit_events
    FOR EACH ROW EXECUTE FUNCTION vericore_audit_events_hash_chain();

CREATE TRIGGER audit_events_no_update
    BEFORE UPDATE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION vericore_audit_events_append_only();

CREATE TRIGGER audit_events_no_delete
    BEFORE DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION vericore_audit_events_append_only();

-- TRUNCATE bypasses row-level triggers entirely, so it needs its own.
CREATE TRIGGER audit_events_no_truncate
    BEFORE TRUNCATE ON audit_events
    FOR EACH STATEMENT EXECUTE FUNCTION vericore_audit_events_append_only();
"""


def upgrade() -> None:
    # ── Enum types ──────────────────────────────────────────────────────
    # Created explicitly, ahead of the tables, because four of them are
    # used by more than one column and would otherwise be created twice.
    ACTOR_TYPE = postgresql.ENUM("system", "officer", name="actor_type", create_type=False)
    APPLICABILITY_SCOPE = postgresql.ENUM(
        "lead_only",
        "any_member",
        "all_members",
        "aggregate",
        name="applicability_scope",
        create_type=False,
    )
    BID_MEMBER_ROLE = postgresql.ENUM(
        "sole", "lead", "member", name="bid_member_role", create_type=False
    )
    BOUNDARY_METHOD = postgresql.ENUM(
        "whole_file",
        "pdf_outline",
        "page_classification",
        "boundary_signals",
        "llm_confirmation",
        "officer_corrected",
        "fallback_unsegmented",
        name="boundary_method",
        create_type=False,
    )
    COMPLIANCE_STATUS = postgresql.ENUM(
        "COMPLIANT",
        "NON_COMPLIANT",
        "PARTIALLY_COMPLIANT",
        "MISSING_EVIDENCE",
        "INCONSISTENT",
        "EXPIRED",
        "UNVERIFIED",
        "NOT_APPLICABLE",
        "NEEDS_HUMAN_REVIEW",
        name="compliance_status",
        create_type=False,
    )
    DECISION_OUTCOME = postgresql.ENUM(
        "qualify", "seek_clarification", "disqualify", name="decision_outcome", create_type=False
    )
    INGESTION_MODE = postgresql.ENUM(
        "separate", "auto_classify", "merged", name="ingestion_mode", create_type=False
    )
    LOCATOR_STATUS = postgresql.ENUM(
        "exact",
        "normalized",
        "fuzzy",
        "ocr",
        "page_fallback",
        "segment_fallback",
        name="locator_status",
        create_type=False,
    )
    RECOMMENDATION_ACTION = postgresql.ENUM(
        "RECOMMEND_QUALIFY",
        "SEEK_CLARIFICATION",
        "RECOMMEND_DISQUALIFY",
        "MANUAL_REVIEW_REQUIRED",
        name="recommendation_action",
        create_type=False,
    )
    RISK_LEVEL = postgresql.ENUM(
        "LOW", "MEDIUM", "HIGH", "CRITICAL", name="risk_level", create_type=False
    )
    SEVERITY = postgresql.ENUM(
        "info", "warning", "high", "critical", name="severity", create_type=False
    )
    TENDER_STATUS = postgresql.ENUM(
        "draft",
        "requirements_extracted",
        "requirements_confirmed",
        "closed",
        name="tender_status",
        create_type=False,
    )
    USER_ROLE = postgresql.ENUM(
        "officer", "reviewer", "auditor", "admin", name="user_role", create_type=False
    )
    VERIFICATION_RESULT_STATUS = postgresql.ENUM(
        "found",
        "not_found",
        "invalid_format",
        "unavailable",
        name="verification_result_status",
        create_type=False,
    )
    VERIFICATION_RUN_STATUS = postgresql.ENUM(
        "queued",
        "running",
        "succeeded",
        "failed",
        name="verification_run_status",
        create_type=False,
    )
    VERIFICATION_SOURCE = postgresql.ENUM(
        "live", "simulated", name="verification_source", create_type=False
    )

    for enum_type in (
        ACTOR_TYPE,
        APPLICABILITY_SCOPE,
        BID_MEMBER_ROLE,
        BOUNDARY_METHOD,
        COMPLIANCE_STATUS,
        DECISION_OUTCOME,
        INGESTION_MODE,
        LOCATOR_STATUS,
        RECOMMENDATION_ACTION,
        RISK_LEVEL,
        SEVERITY,
        TENDER_STATUS,
        USER_ROLE,
        VERIFICATION_RESULT_STATUS,
        VERIFICATION_RUN_STATUS,
        VERIFICATION_SOURCE,
    ):
        enum_type.create(op.get_bind(), checkfirst=False)

    # ── Tables, in dependency order ─────────────────────────────────────
    op.create_table(
        "bidders",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("legal_name", sa.String(length=300), nullable=False),
        sa.Column("normalized_name", sa.String(length=300), nullable=True),
        sa.Column("pan", sa.String(length=10), nullable=True),
        sa.Column("gstin", sa.String(length=15), nullable=True),
        sa.Column("udyam_urn", sa.String(length=25), nullable=True),
        sa.Column("cin", sa.String(length=21), nullable=True),
        sa.Column("registered_address", sa.Text(), nullable=True),
        sa.Column("state_code", sa.String(length=2), nullable=True),
        sa.Column("pincode", sa.String(length=6), nullable=True),
        sa.Column("incorporation_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bidders")),
        sa.UniqueConstraint("pan", name=op.f("uq_bidders_pan")),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("role", USER_ROLE, nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )

    op.create_table(
        "tenders",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bid_number", sa.String(length=120), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("buyer_organisation", sa.String(length=300), nullable=True),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("estimated_value", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default=sa.text("'INR'"), nullable=False),
        sa.Column("bid_due_date", sa.Date(), nullable=True),
        sa.Column("contract_start_date", sa.Date(), nullable=True),
        sa.Column("emd_amount", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("mse_relaxation", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "startup_relaxation", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("status", TENDER_STATUS, server_default=sa.text("'draft'"), nullable=False),
        sa.Column("requirements_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requirements_confirmed_by", sa.UUID(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(status <> 'requirements_confirmed') OR (requirements_confirmed_at IS NOT NULL)",
            name=op.f("ck_tenders_confirmed_requires_timestamp"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_tenders_created_by_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["requirements_confirmed_by"],
            ["users.id"],
            name=op.f("fk_tenders_requirements_confirmed_by_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tenders")),
        sa.UniqueConstraint("bid_number", name="uq_tenders_bid_number"),
    )

    op.create_table(
        "bids",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tender_id", sa.UUID(), nullable=False),
        sa.Column("reference", sa.String(length=80), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("compliance_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("mandatory_gate_passed", sa.Boolean(), nullable=True),
        sa.Column("score_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("risk_level", RISK_LEVEL, nullable=True),
        sa.Column("recommendation_text", sa.Text(), nullable=True),
        sa.Column("recommendation_action", RECOMMENDATION_ACTION, nullable=True),
        sa.Column("recommendation_cited_requirements", postgresql.ARRAY(sa.UUID()), nullable=True),
        sa.Column("decision", DECISION_OUTCOME, nullable=True),
        sa.Column("decision_justification", sa.Text(), nullable=True),
        sa.Column("decided_by", sa.UUID(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "compliance_score IS NULL OR (compliance_score >= 0 AND compliance_score <= 100)",
            name=op.f("ck_bids_score_within_range"),
        ),
        sa.CheckConstraint(
            "decision IS NULL OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_justification IS NOT NULL AND length(btrim(decision_justification)) > 0)",
            name=op.f("ck_bids_decision_requires_actor_and_justification"),
        ),
        sa.ForeignKeyConstraint(
            ["decided_by"], ["users.id"], name=op.f("fk_bids_decided_by_users"), ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["tender_id"],
            ["tenders.id"],
            name=op.f("fk_bids_tender_id_tenders"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bids")),
    )

    op.create_table(
        "requirements",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tender_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("raw_clause", sa.Text(), nullable=True),
        sa.Column("normalized_clause", sa.Text(), nullable=True),
        sa.Column("condition", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("mandatory", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "weight", sa.Numeric(precision=6, scale=2), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "applicability_scope",
            APPLICABILITY_SCOPE,
            server_default=sa.text("'lead_only'"),
            nullable=False,
        ),
        sa.Column(
            "accepts_document_types",
            postgresql.ARRAY(sa.String(length=80)),
            server_default=sa.text("'{}'::varchar[]"),
            nullable=False,
        ),
        sa.Column(
            "required_fields",
            postgresql.ARRAY(sa.String(length=80)),
            server_default=sa.text("'{}'::varchar[]"),
            nullable=False,
        ),
        sa.Column("external_check", sa.String(length=40), nullable=True),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("source_clause_ref", sa.String(length=120), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("confirmed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "edited_by_officer", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("extraction_confidence", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("weight >= 0", name=op.f("ck_requirements_weight_non_negative")),
        sa.ForeignKeyConstraint(
            ["tender_id"],
            ["tenders.id"],
            name=op.f("fk_requirements_tender_id_tenders"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_requirements")),
        sa.UniqueConstraint("tender_id", "code", name="uq_requirements_tender_id_code"),
    )

    op.create_table(
        "bid_members",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bid_id", sa.UUID(), nullable=False),
        sa.Column("bidder_id", sa.UUID(), nullable=False),
        sa.Column("role", BID_MEMBER_ROLE, nullable=False),
        sa.Column("member_order", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("share_percent", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["bid_id"], ["bids.id"], name=op.f("fk_bid_members_bid_id_bids"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["bidder_id"],
            ["bidders.id"],
            name=op.f("fk_bid_members_bidder_id_bidders"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bid_members")),
        sa.UniqueConstraint("bid_id", "bidder_id", name="uq_bid_members_bid_id_bidder_id"),
    )

    op.create_table(
        "reports",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tender_id", sa.UUID(), nullable=True),
        sa.Column("bid_id", sa.UUID(), nullable=True),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("audit_chain_head", sa.String(length=64), nullable=True),
        sa.Column(
            "contains_simulated_results",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("generated_by", sa.UUID(), nullable=True),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(tender_id IS NOT NULL)::int + (bid_id IS NOT NULL)::int >= 1",
            name=op.f("ck_reports_report_has_a_subject"),
        ),
        sa.ForeignKeyConstraint(
            ["bid_id"], ["bids.id"], name=op.f("fk_reports_bid_id_bids"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["generated_by"],
            ["users.id"],
            name=op.f("fk_reports_generated_by_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tender_id"],
            ["tenders.id"],
            name=op.f("fk_reports_tender_id_tenders"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reports")),
    )

    op.create_table(
        "risk_flags",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bid_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=60), nullable=False),
        sa.Column("category", sa.String(length=60), nullable=True),
        sa.Column("severity", SEVERITY, nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("evidence_refs", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["bid_id"], ["bids.id"], name=op.f("fk_risk_flags_bid_id_bids"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_risk_flags")),
        sa.UniqueConstraint("bid_id", "code", name="uq_risk_flags_bid_id_code"),
    )

    op.create_table(
        "verification_runs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bid_id", sa.UUID(), nullable=False),
        sa.Column(
            "status", VERIFICATION_RUN_STATUS, server_default=sa.text("'queued'"), nullable=False
        ),
        sa.Column("phase", sa.String(length=60), nullable=True),
        sa.Column("progress_completed", sa.Integer(), nullable=True),
        sa.Column("progress_total", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "progress_completed IS NULL OR progress_completed >= 0",
            name=op.f("ck_verification_runs_progress_completed_non_negative"),
        ),
        sa.CheckConstraint(
            "progress_total IS NULL OR progress_completed IS NULL OR progress_completed <= progress_total",
            name=op.f("ck_verification_runs_progress_within_total"),
        ),
        sa.ForeignKeyConstraint(
            ["bid_id"],
            ["bids.id"],
            name=op.f("fk_verification_runs_bid_id_bids"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_verification_runs")),
    )

    op.create_table(
        "compliance_results",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bid_id", sa.UUID(), nullable=False),
        sa.Column("requirement_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            COMPLIANCE_STATUS,
            server_default=sa.text("'MISSING_EVIDENCE'"),
            nullable=False,
        ),
        sa.Column("applicable", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("verification_method", sa.String(length=60), nullable=True),
        sa.Column("satisfied_by_bid_member_id", sa.UUID(), nullable=True),
        sa.Column("external_check_portal", sa.String(length=40), nullable=True),
        sa.Column("external_check_status", VERIFICATION_RESULT_STATUS, nullable=True),
        sa.Column("external_check_source", VERIFICATION_SOURCE, nullable=True),
        sa.Column("override_status", COMPLIANCE_STATUS, nullable=True),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("override_by", sa.UUID(), nullable=True),
        sa.Column("override_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("llm_provider", sa.String(length=40), nullable=True),
        sa.Column("llm_model_id", sa.String(length=120), nullable=True),
        sa.Column("llm_role", sa.String(length=20), nullable=True),
        sa.Column(
            "evaluated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "external_check_status IS NULL OR external_check_source IS NOT NULL",
            name=op.f("ck_compliance_results_external_result_must_declare_source"),
        ),
        sa.CheckConstraint(
            "override_status IS NULL OR (override_by IS NOT NULL AND override_at IS NOT NULL AND override_reason IS NOT NULL AND length(btrim(override_reason)) > 0)",
            name=op.f("ck_compliance_results_override_requires_actor_and_reason"),
        ),
        sa.ForeignKeyConstraint(
            ["bid_id"],
            ["bids.id"],
            name=op.f("fk_compliance_results_bid_id_bids"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["override_by"],
            ["users.id"],
            name=op.f("fk_compliance_results_override_by_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["requirement_id"],
            ["requirements.id"],
            name=op.f("fk_compliance_results_requirement_id_requirements"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["satisfied_by_bid_member_id"],
            ["bid_members.id"],
            name=op.f("fk_compliance_results_satisfied_by_bid_member_id_bid_members"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_compliance_results")),
        sa.UniqueConstraint(
            "bid_id", "requirement_id", name="uq_compliance_results_bid_id_requirement_id"
        ),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tender_id", sa.UUID(), nullable=True),
        sa.Column("bid_id", sa.UUID(), nullable=True),
        sa.Column("bid_member_id", sa.UUID(), nullable=True),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("ingestion_mode", INGESTION_MODE, nullable=False),
        sa.Column("segmentation_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("segmentation_confirmed_by", sa.UUID(), nullable=True),
        sa.Column("uploaded_by", sa.UUID(), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "sha256 ~ '^[0-9a-f]{64}$'", name=op.f("ck_documents_sha256_is_lowercase_hex")
        ),
        sa.CheckConstraint(
            "(tender_id IS NOT NULL)::int + (bid_id IS NOT NULL)::int = 1",
            name=op.f("ck_documents_belongs_to_exactly_one_owner"),
        ),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_documents_size_positive")),
        sa.ForeignKeyConstraint(
            ["bid_id"], ["bids.id"], name=op.f("fk_documents_bid_id_bids"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["bid_member_id"],
            ["bid_members.id"],
            name=op.f("fk_documents_bid_member_id_bid_members"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["segmentation_confirmed_by"],
            ["users.id"],
            name=op.f("fk_documents_segmentation_confirmed_by_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tender_id"],
            ["tenders.id"],
            name=op.f("fk_documents_tender_id_tenders"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["users.id"],
            name=op.f("fk_documents_uploaded_by_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_documents")),
    )

    op.create_table(
        "portal_checks",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bid_id", sa.UUID(), nullable=False),
        sa.Column("bid_member_id", sa.UUID(), nullable=True),
        sa.Column("requirement_id", sa.UUID(), nullable=True),
        sa.Column("verification_run_id", sa.UUID(), nullable=True),
        sa.Column("portal_id", sa.String(length=40), nullable=False),
        sa.Column("identifier", sa.String(length=60), nullable=False),
        sa.Column("status", VERIFICATION_RESULT_STATUS, nullable=False),
        sa.Column("source", VERIFICATION_SOURCE, nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("raw_response_hash", sa.String(length=64), nullable=True),
        sa.Column(
            "retrieved_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["bid_id"], ["bids.id"], name=op.f("fk_portal_checks_bid_id_bids"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["bid_member_id"],
            ["bid_members.id"],
            name=op.f("fk_portal_checks_bid_member_id_bid_members"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["requirement_id"],
            ["requirements.id"],
            name=op.f("fk_portal_checks_requirement_id_requirements"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["verification_run_id"],
            ["verification_runs.id"],
            name=op.f("fk_portal_checks_verification_run_id_verification_runs"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portal_checks")),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("seq", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("tender_id", sa.UUID(), nullable=True),
        sa.Column("bid_id", sa.UUID(), nullable=True),
        sa.Column("requirement_id", sa.UUID(), nullable=True),
        sa.Column("document_id", sa.UUID(), nullable=True),
        sa.Column("event_type", sa.String(length=60), nullable=False),
        sa.Column("actor_type", ACTOR_TYPE, nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("actor_component", sa.String(length=60), nullable=True),
        sa.Column("previous_state", sa.String(length=40), nullable=True),
        sa.Column("new_state", sa.String(length=40), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("input_hash", sa.String(length=64), nullable=True),
        sa.Column("llm_provider", sa.String(length=40), nullable=True),
        sa.Column("llm_model_id", sa.String(length=120), nullable=True),
        sa.Column("llm_role", sa.String(length=20), nullable=True),
        sa.Column("prev_hash", sa.String(length=64), nullable=False),
        sa.Column("row_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(actor_type <> 'officer') OR (actor_id IS NOT NULL)",
            name=op.f("ck_audit_events_officer_events_name_the_officer"),
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name=op.f("fk_audit_events_actor_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["bid_id"], ["bids.id"], name=op.f("fk_audit_events_bid_id_bids"), ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_audit_events_document_id_documents"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["requirement_id"],
            ["requirements.id"],
            name=op.f("fk_audit_events_requirement_id_requirements"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tender_id"],
            ["tenders.id"],
            name=op.f("fk_audit_events_tender_id_tenders"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_events")),
        sa.UniqueConstraint("row_hash", name=op.f("uq_audit_events_row_hash")),
        sa.UniqueConstraint("seq", name=op.f("uq_audit_events_seq")),
    )

    op.create_table(
        "document_segments",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("segment_index", sa.Integer(), nullable=False),
        sa.Column(
            "doc_type",
            sa.String(length=80),
            server_default=sa.text("'unclassified'"),
            nullable=False,
        ),
        sa.Column("classification_confidence", sa.Float(), nullable=True),
        sa.Column("page_start", sa.Integer(), nullable=False),
        sa.Column("page_end", sa.Integer(), nullable=False),
        sa.Column("boundary_method", BOUNDARY_METHOD, nullable=False),
        sa.Column("boundary_confidence", sa.Float(), nullable=True),
        sa.Column("needs_review", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "boundary_confidence IS NULL OR (boundary_confidence >= 0 AND boundary_confidence <= 1)",
            name=op.f("ck_document_segments_boundary_confidence_within_range"),
        ),
        sa.CheckConstraint(
            "page_end >= page_start", name=op.f("ck_document_segments_page_range_ordered")
        ),
        sa.CheckConstraint(
            "page_start >= 1", name=op.f("ck_document_segments_page_start_is_one_based")
        ),
        sa.ForeignKeyConstraint(
            ["confirmed_by"],
            ["users.id"],
            name=op.f("fk_document_segments_confirmed_by_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_document_segments_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_document_segments")),
        sa.UniqueConstraint(
            "document_id", "segment_index", name="uq_document_segments_document_id_segment_index"
        ),
    )

    op.create_table(
        "cross_document_findings",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bid_id", sa.UUID(), nullable=False),
        sa.Column("bid_member_id", sa.UUID(), nullable=True),
        sa.Column("finding_type", sa.String(length=60), nullable=False),
        sa.Column("severity", SEVERITY, nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("field_name", sa.String(length=80), nullable=True),
        sa.Column("value_a", sa.Text(), nullable=True),
        sa.Column("value_b", sa.Text(), nullable=True),
        sa.Column("segment_a_id", sa.UUID(), nullable=True),
        sa.Column("segment_b_id", sa.UUID(), nullable=True),
        sa.Column("similarity_score", sa.Float(), nullable=True),
        sa.Column("normalization_steps", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("resolved_by", sa.UUID(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "resolved_at IS NULL OR (resolved_by IS NOT NULL AND resolution_reason IS NOT NULL AND length(btrim(resolution_reason)) > 0)",
            name=op.f("ck_cross_document_findings_resolution_requires_actor_and_reason"),
        ),
        sa.ForeignKeyConstraint(
            ["bid_id"],
            ["bids.id"],
            name=op.f("fk_cross_document_findings_bid_id_bids"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["bid_member_id"],
            ["bid_members.id"],
            name=op.f("fk_cross_document_findings_bid_member_id_bid_members"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["resolved_by"],
            ["users.id"],
            name=op.f("fk_cross_document_findings_resolved_by_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["segment_a_id"],
            ["document_segments.id"],
            name=op.f("fk_cross_document_findings_segment_a_id_document_segments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["segment_b_id"],
            ["document_segments.id"],
            name=op.f("fk_cross_document_findings_segment_b_id_document_segments"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cross_document_findings")),
    )

    op.create_table(
        "evidence",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("bid_id", sa.UUID(), nullable=False),
        sa.Column("requirement_id", sa.UUID(), nullable=False),
        sa.Column("document_segment_id", sa.UUID(), nullable=False),
        sa.Column("bid_member_id", sa.UUID(), nullable=True),
        sa.Column(
            "extracted_field_ids",
            postgresql.ARRAY(sa.UUID()),
            server_default=sa.text("'{}'::uuid[]"),
            nullable=False,
        ),
        sa.Column("field_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["bid_id"], ["bids.id"], name=op.f("fk_evidence_bid_id_bids"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["bid_member_id"],
            ["bid_members.id"],
            name=op.f("fk_evidence_bid_member_id_bid_members"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["document_segment_id"],
            ["document_segments.id"],
            name=op.f("fk_evidence_document_segment_id_document_segments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["requirement_id"],
            ["requirements.id"],
            name=op.f("fk_evidence_requirement_id_requirements"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evidence")),
    )

    op.create_table(
        "extracted_fields",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_segment_id", sa.UUID(), nullable=False),
        sa.Column("field_name", sa.String(length=80), nullable=False),
        sa.Column("field_value", sa.Text(), nullable=True),
        sa.Column("value_normalized", sa.Text(), nullable=True),
        sa.Column("value_numeric", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("value_date", sa.Date(), nullable=True),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("x0", sa.Float(), nullable=False),
        sa.Column("y0", sa.Float(), nullable=False),
        sa.Column("x1", sa.Float(), nullable=False),
        sa.Column("y1", sa.Float(), nullable=False),
        sa.Column("locator_status", LOCATOR_STATUS, nullable=False),
        sa.Column("locator_score", sa.Float(), nullable=True),
        sa.Column("bbox_rects", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("extraction_method", sa.String(length=40), nullable=False),
        sa.Column("source_span", sa.Text(), nullable=True),
        sa.Column("llm_provider", sa.String(length=40), nullable=True),
        sa.Column("llm_model_id", sa.String(length=120), nullable=True),
        sa.Column("llm_role", sa.String(length=20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "confidence >= 0 AND confidence <= 1",
            name=op.f("ck_extracted_fields_confidence_within_range"),
        ),
        sa.CheckConstraint(
            "locator_score IS NULL OR (locator_score >= 0 AND locator_score <= 1)",
            name=op.f("ck_extracted_fields_locator_score_within_range"),
        ),
        sa.CheckConstraint("page >= 1", name=op.f("ck_extracted_fields_page_is_one_based")),
        sa.CheckConstraint("x1 >= x0 AND y1 >= y0", name=op.f("ck_extracted_fields_bbox_ordered")),
        sa.ForeignKeyConstraint(
            ["document_segment_id"],
            ["document_segments.id"],
            name=op.f("fk_extracted_fields_document_segment_id_document_segments"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_extracted_fields")),
    )

    # ── Indexes ────────────────────────────────────────────────────────
    op.create_index(
        op.f("ix_bidders_normalized_name"), "bidders", ["normalized_name"], unique=False
    )
    op.create_index(op.f("ix_bids_tender_id"), "bids", ["tender_id"], unique=False)
    op.create_index(op.f("ix_requirements_tender_id"), "requirements", ["tender_id"], unique=False)
    op.create_index(op.f("ix_bid_members_bid_id"), "bid_members", ["bid_id"], unique=False)
    op.create_index(op.f("ix_bid_members_bidder_id"), "bid_members", ["bidder_id"], unique=False)
    op.create_index(op.f("ix_reports_bid_id"), "reports", ["bid_id"], unique=False)
    op.create_index(op.f("ix_reports_tender_id"), "reports", ["tender_id"], unique=False)
    op.create_index(op.f("ix_risk_flags_bid_id"), "risk_flags", ["bid_id"], unique=False)
    op.create_index(
        op.f("ix_verification_runs_bid_id"), "verification_runs", ["bid_id"], unique=False
    )
    op.create_index(
        op.f("ix_compliance_results_bid_id"), "compliance_results", ["bid_id"], unique=False
    )
    op.create_index(
        op.f("ix_compliance_results_requirement_id"),
        "compliance_results",
        ["requirement_id"],
        unique=False,
    )
    op.create_index(op.f("ix_documents_bid_id"), "documents", ["bid_id"], unique=False)
    op.create_index(op.f("ix_documents_sha256"), "documents", ["sha256"], unique=False)
    op.create_index(op.f("ix_documents_tender_id"), "documents", ["tender_id"], unique=False)
    op.create_index(op.f("ix_portal_checks_bid_id"), "portal_checks", ["bid_id"], unique=False)
    op.create_index(
        op.f("ix_portal_checks_portal_id_identifier"),
        "portal_checks",
        ["portal_id", "identifier"],
        unique=False,
    )
    op.create_index(
        op.f("ix_portal_checks_verification_run_id"),
        "portal_checks",
        ["verification_run_id"],
        unique=False,
    )
    op.create_index(op.f("ix_audit_events_bid_id"), "audit_events", ["bid_id"], unique=False)
    op.create_index(
        op.f("ix_audit_events_created_at"), "audit_events", ["created_at"], unique=False
    )
    op.create_index(op.f("ix_audit_events_tender_id"), "audit_events", ["tender_id"], unique=False)
    op.create_index(
        op.f("ix_document_segments_doc_type"), "document_segments", ["doc_type"], unique=False
    )
    op.create_index(
        op.f("ix_document_segments_document_id"), "document_segments", ["document_id"], unique=False
    )
    op.create_index(
        op.f("ix_cross_document_findings_bid_id"),
        "cross_document_findings",
        ["bid_id"],
        unique=False,
    )
    op.create_index(op.f("ix_evidence_bid_id"), "evidence", ["bid_id"], unique=False)
    op.create_index(
        op.f("ix_evidence_bid_id_requirement_id"),
        "evidence",
        ["bid_id", "requirement_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_evidence_requirement_id"), "evidence", ["requirement_id"], unique=False
    )
    op.create_index(
        op.f("ix_extracted_fields_document_segment_id"),
        "extracted_fields",
        ["document_segment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_extracted_fields_field_name"), "extracted_fields", ["field_name"], unique=False
    )

    # ── Append-only, hash-chained audit log ────────────────────────────
    op.execute(AUDIT_PAYLOAD_FN.rstrip().rstrip(";"))
    op.execute(AUDIT_HASH_CHAIN_FN.rstrip().rstrip(";"))
    op.execute(AUDIT_APPEND_ONLY_FN.rstrip().rstrip(";"))
    op.execute(AUDIT_VERIFY_FN.rstrip().rstrip(";"))
    op.execute(AUDIT_TRIGGERS.rstrip().rstrip(";"))


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events")
    op.execute("DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events")
    op.execute("DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events")
    op.execute("DROP TRIGGER IF EXISTS audit_events_hash_chain ON audit_events")
    op.execute("DROP FUNCTION IF EXISTS vericore_audit_chain_verify()")
    op.execute("DROP FUNCTION IF EXISTS vericore_audit_events_append_only()")
    op.execute("DROP FUNCTION IF EXISTS vericore_audit_events_hash_chain()")
    op.execute("DROP FUNCTION IF EXISTS vericore_audit_event_payload(audit_events)")

    op.drop_index(op.f("ix_extracted_fields_document_segment_id"), table_name="extracted_fields")
    op.drop_index(op.f("ix_extracted_fields_field_name"), table_name="extracted_fields")
    op.drop_index(op.f("ix_evidence_bid_id"), table_name="evidence")
    op.drop_index(op.f("ix_evidence_bid_id_requirement_id"), table_name="evidence")
    op.drop_index(op.f("ix_evidence_requirement_id"), table_name="evidence")
    op.drop_index(op.f("ix_cross_document_findings_bid_id"), table_name="cross_document_findings")
    op.drop_index(op.f("ix_document_segments_doc_type"), table_name="document_segments")
    op.drop_index(op.f("ix_document_segments_document_id"), table_name="document_segments")
    op.drop_index(op.f("ix_audit_events_bid_id"), table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_created_at"), table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_tender_id"), table_name="audit_events")
    op.drop_index(op.f("ix_portal_checks_bid_id"), table_name="portal_checks")
    op.drop_index(op.f("ix_portal_checks_portal_id_identifier"), table_name="portal_checks")
    op.drop_index(op.f("ix_portal_checks_verification_run_id"), table_name="portal_checks")
    op.drop_index(op.f("ix_documents_bid_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_sha256"), table_name="documents")
    op.drop_index(op.f("ix_documents_tender_id"), table_name="documents")
    op.drop_index(op.f("ix_compliance_results_bid_id"), table_name="compliance_results")
    op.drop_index(op.f("ix_compliance_results_requirement_id"), table_name="compliance_results")
    op.drop_index(op.f("ix_verification_runs_bid_id"), table_name="verification_runs")
    op.drop_index(op.f("ix_risk_flags_bid_id"), table_name="risk_flags")
    op.drop_index(op.f("ix_reports_bid_id"), table_name="reports")
    op.drop_index(op.f("ix_reports_tender_id"), table_name="reports")
    op.drop_index(op.f("ix_bid_members_bid_id"), table_name="bid_members")
    op.drop_index(op.f("ix_bid_members_bidder_id"), table_name="bid_members")
    op.drop_index(op.f("ix_requirements_tender_id"), table_name="requirements")
    op.drop_index(op.f("ix_bids_tender_id"), table_name="bids")
    op.drop_index(op.f("ix_bidders_normalized_name"), table_name="bidders")
    op.drop_table("extracted_fields")
    op.drop_table("evidence")
    op.drop_table("cross_document_findings")
    op.drop_table("document_segments")
    op.drop_table("audit_events")
    op.drop_table("portal_checks")
    op.drop_table("documents")
    op.drop_table("compliance_results")
    op.drop_table("verification_runs")
    op.drop_table("risk_flags")
    op.drop_table("reports")
    op.drop_table("bid_members")
    op.drop_table("requirements")
    op.drop_table("bids")
    op.drop_table("tenders")
    op.drop_table("users")
    op.drop_table("bidders")

    for enum_name in (
        "actor_type",
        "applicability_scope",
        "bid_member_role",
        "boundary_method",
        "compliance_status",
        "decision_outcome",
        "ingestion_mode",
        "locator_status",
        "recommendation_action",
        "risk_level",
        "severity",
        "tender_status",
        "user_role",
        "verification_result_status",
        "verification_run_status",
        "verification_source",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
