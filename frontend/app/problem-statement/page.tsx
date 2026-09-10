import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ArrowLeft, Landmark, FileText, CheckCircle2, Shield, Scale, Database, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ProblemStatementPage() {
  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <SiteHeader />

      <main className="mx-auto max-w-[880px] px-6 py-12">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-seal transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to overview</span>
          </Link>
        </div>

        {/* Editorial Masthead */}
        <header className="border-b border-rule pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[2px] bg-seal text-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider">
              SIH26100
            </span>
            <span className="text-[12px] text-ink-faint font-mono">
              Smart Automation · Ministry of Petroleum & Natural Gas
            </span>
          </div>

          <h1 className="mt-3 font-serif text-[32px] sm:text-[40px] font-semibold text-ink leading-[1.15] tracking-tight">
            AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-ink-muted border-t border-rule pt-4">
            <div>
              <span className="text-ink-faint">Client Organization:</span>{" "}
              <strong className="font-medium text-ink">Chennai Petroleum Corporation Limited (CPCL)</strong>
            </div>
            <div>
              <span className="text-ink-faint">Governing Framework:</span>{" "}
              <strong className="font-medium text-ink">Government e-Marketplace (GeM)</strong>
            </div>
          </div>
        </header>

        {/* Core Narrative */}
        <article className="mt-8 space-y-10 text-[15px] leading-relaxed text-ink">
          {/* Executive Overview */}
          <section className="space-y-4">
            <h2 className="font-serif text-[22px] font-semibold text-ink">
              1. The Procurement Verification Challenge
            </h2>
            <p className="text-ink-muted leading-relaxed">
              Public procurement officers at Chennai Petroleum Corporation Limited (CPCL) and across Central Public Sector Undertakings (CPSUs)
              manage hundreds of high-value tenders annually through the Government e-Marketplace (GeM). Every tender is governed by a detailed
              Notice Inviting Tender (NIT) containing stringent statutory, technical, and financial eligibility criteria.
            </p>
            <p className="text-ink-muted leading-relaxed">
              For each tender, bidders submit massive PDF document bundles—often exceeding 80 to 200 pages—encompassing audited financial balance sheets,
              GST registration certificates, PAN cards, Udyam MSME certificates, previous work completion orders, OEM authorizations, and blacklisting affidavits.
              Evaluating these submissions manually requires exhaustive line-by-line cross-referencing under extreme deadline pressure.
            </p>
          </section>

          {/* Core Failure Points */}
          <section className="space-y-4">
            <h2 className="font-serif text-[22px] font-semibold text-ink">
              2. Structural Vulnerabilities in Manual Evaluation
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-[4px] border border-rule bg-surface p-4 panel-shadow">
                <h3 className="font-serif text-[15px] font-semibold text-ink mb-1">Document-Intensive Fatigue</h3>
                <p className="text-[13px] text-ink-muted leading-relaxed">
                  Procurement committees spend 4–8 hours per bidder manually cross-checking financial turnover equations and statutory validity dates, creating substantial operational backlog.
                </p>
              </div>

              <div className="rounded-[4px] border border-rule bg-surface p-4 panel-shadow">
                <h3 className="font-serif text-[15px] font-semibold text-ink mb-1">Cross-Document Contradictions</h3>
                <p className="text-[13px] text-ink-muted leading-relaxed">
                  Critical mismatches (e.g. subtle corporate name variations, or a PAN card differing from the PAN digits inside a GSTIN) are frequently overlooked across multi-page PDF files.
                </p>
              </div>

              <div className="rounded-[4px] border border-rule bg-surface p-4 panel-shadow">
                <h3 className="font-serif text-[15px] font-semibold text-ink mb-1">Portal Fragmentation</h3>
                <p className="text-[13px] text-ink-muted leading-relaxed">
                  Validating identifiers requires disjointed manual visits to GSTN, MCA21, Income Tax e-filing, Udyam, and the Central Vigilance debarment database.
                </p>
              </div>

              <div className="rounded-[4px] border border-rule bg-surface p-4 panel-shadow">
                <h3 className="font-serif text-[15px] font-semibold text-ink mb-1">Audit & Legal Scrutiny</h3>
                <p className="text-[13px] text-ink-muted leading-relaxed">
                  Decisions are routinely subject to RTI queries, CAG audit inspections, and CVC scrutiny. A lack of cryptographic proof trails leaves organizations vulnerable to disputes.
                </p>
              </div>
            </div>
          </section>

          {/* Guiding Philosophy Callout */}
          <section className="rounded-[4px] border border-seal/30 bg-seal-tint p-6">
            <h3 className="font-serif text-[17px] font-semibold text-seal">
              The Guiding Philosophy: The Officer Decides. The System Never Does.
            </h3>
            <p className="mt-2 text-[14px] text-ink-muted leading-relaxed">
              Vericore does not qualify or disqualify bidders autonomously. Under Indian administrative law and statutory public procurement manuals,
              the ultimate decision to award or disqualify belongs strictly to the statutory Procurement Officer.
              Vericore functions as a transparent, evidence-pinpointing decision support instrument—extracting exact coordinates and recomputable arithmetic.
            </p>
          </section>

          {/* Proposed Solution & Architecture */}
          <section className="space-y-4">
            <h2 className="font-serif text-[22px] font-semibold text-ink">
              3. The Nine-Layer Pipeline Architecture
            </h2>
            <p className="text-ink-muted leading-relaxed">
              Vericore isolates processing into distinct, auditable architectural layers. Deterministic rule evaluation is strictly decoupled from language model reasoning:
            </p>

            <div className="divide-y divide-rule rounded-[4px] border border-rule bg-surface overflow-hidden panel-shadow">
              <div className="p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-seal w-8 shrink-0">L1</span>
                <div>
                  <h4 className="font-semibold text-[14px] text-ink">Tender Requirement Extraction (NIT Parser)</h4>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Parses free-text NIT prose into a structured checklist with human confirmation gates.
                  </p>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-seal w-8 shrink-0">L2</span>
                <div>
                  <h4 className="font-semibold text-[14px] text-ink">Document Segmentation & Classification</h4>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Isolates logical documents from multi-file bundles using PyMuPDF and rule-based classifiers.
                  </p>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-seal w-8 shrink-0">L3</span>
                <div>
                  <h4 className="font-semibold text-[14px] text-ink">Deterministic Evidence Extraction (OCR + Coordinates)</h4>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Extracts numerical and statutory fields with exact page bounding-box coordinates for 1-click drill-downs.
                  </p>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-seal w-8 shrink-0">L4</span>
                <div>
                  <h4 className="font-semibold text-[14px] text-ink">Requirement-to-Evidence Matching</h4>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Deterministic rule evaluation first; semantic LLM judgment invoked only for qualitative prose requirements.
                  </p>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-seal w-8 shrink-0">L5</span>
                <div>
                  <h4 className="font-semibold text-[14px] text-ink">Cross-Document Verification Engine</h4>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Fully deterministic Python engine identifying contradictions across the bidder&apos;s own documentation.
                  </p>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-seal w-8 shrink-0">L6</span>
                <div>
                  <h4 className="font-semibold text-[14px] text-ink">Government Portal Adapter Layer</h4>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Unified adapter interfacing Udyam, GSTN, MCA21, PAN, and DigiLocker (transparently stamped LIVE or SIMULATED).
                  </p>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-seal w-8 shrink-0">L7</span>
                <div>
                  <h4 className="font-semibold text-[14px] text-ink">Compliance State Machine</h4>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Finite state machine governing COMPLIANT, NON_COMPLIANT, MISSING_EVIDENCE, EXPIRED, INCONSISTENT, and REVIEW.
                  </p>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-seal w-8 shrink-0">L8</span>
                <div>
                  <h4 className="font-semibold text-[14px] text-ink">Arithmetic Scoring & Risk Assessment</h4>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    Hand-recomputable weighted arithmetic score and counted risk signals (never hallucinated by an LLM).
                  </p>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <span className="font-mono text-xs font-bold text-seal w-8 shrink-0">L9</span>
                <div>
                  <h4 className="font-semibold text-[14px] text-ink">Append-Only Hash-Chained Audit Trail</h4>
                  <p className="text-[13px] text-ink-muted mt-0.5">
                    PostgreSQL SHA-256 hash chains with database-level triggers preventing modification, guaranteeing RTI compliance.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </article>

        {/* Footer Navigation */}
        <div className="mt-12 border-t border-rule pt-6 flex items-center justify-between">
          <Link
            href="/tenders"
            className="inline-flex items-center gap-1.5 rounded-[3px] bg-seal px-4 py-2 text-[13px] font-medium text-white hover:bg-seal-strong transition-colors"
          >
            <span>Proceed to Officer Workspace →</span>
          </Link>
          <Link
            href="/about-us"
            className="text-[13px] text-ink-muted hover:text-seal transition-colors"
          >
            Meet the Engineering Team →
          </Link>
        </div>
      </main>
    </div>
  );
}
