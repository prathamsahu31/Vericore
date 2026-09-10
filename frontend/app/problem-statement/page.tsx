"use client";

import { motion } from "framer-motion";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { BackButton } from "@/components/ui/BackButton";

export default function ProblemStatementPage() {
    return (
        <div className="relative min-h-screen bg-paper text-ink selection:bg-seal/20">
            {/* Background Texture */}
            <div className="pointer-events-none absolute inset-0 bg-[url('/bg2.svg')] bg-cover bg-center bg-no-repeat opacity-50 mix-blend-multiply" />

            <SiteHeader />

            <main className="relative z-10 mx-auto max-w-4xl px-6 py-20 sm:py-32">
                <BackButton />
                <motion.article
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="prose prose-slate prose-lg max-w-none"
                >
                    {/* Eyebrow */}
                    <div className="mb-4 flex items-center gap-3">
                        <span className="h-px w-8 bg-seal"></span>
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-seal">
                            SIH26100
                        </span>
                    </div>

                    {/* Main Title */}
                    <h1 className="mb-10 font-serif text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
                        The Challenge: Manual & Error-Prone Bid Compliance Verification
                    </h1>

                    {/* Introduction / Lead Paragraph */}
                    <p className="mb-12 text-lg leading-relaxed text-ink-muted">
                        <strong className="text-ink">Problem:</strong> Government procurement officers must manually verify large bidder document bundles against tender-specific eligibility requirements hidden within free-text NIT/RFP documents.
                    </p>

                    {/* Section 1 */}
                    <section className="mb-16">
                        <h2 className="mb-6 font-serif text-3xl font-semibold text-ink">
                            Why is this difficult?
                        </h2>

                        <ul className="mb-8 space-y-4 pl-6 text-ink-muted">
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span><strong>Time-consuming:</strong> 40+ bidder documents can take hours to review manually.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span><strong>Complex requirements:</strong> Turnover, experience, GST/PAN/Udyam, OEM authorization, certificates, EMD, local content, etc. vary from tender to tender.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span><strong>Cross-document verification:</strong> Critical information such as names, IDs, dates and financial figures must be compared across multiple documents.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span><strong>Human error:</strong> Manual extraction and comparison can lead to missed inconsistencies or incorrect decisions.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span><strong>Poor traceability:</strong> It is difficult to link every compliance decision back to the exact supporting document and page.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span><strong>Audit challenges:</strong> Procurement decisions need to be transparent and defensible under RTI/CVC audits.</span>
                            </li>
                        </ul>
                    </section>

                    {/* Proposed Solution */}
                    <section className="mb-16">
                        <h2 className="mb-6 font-serif text-3xl font-semibold text-ink">
                            Proposed Solution
                        </h2>
                        <h3 className="mb-4 font-serif text-2xl font-medium text-ink">
                            Vericore — AI-Powered Bid Compliance Verification Platform
                        </h3>
                        <p className="mb-6 leading-relaxed text-ink-muted">
                            Vericore transforms unstructured tender requirements and bidder documents into a structured, evidence-backed compliance workflow.
                        </p>

                        <div className="mb-8 rounded-xl border border-rule/50 bg-white/40 p-6 shadow-[0_4px_30px_rgba(0,0,0,0.05)] backdrop-blur-md font-mono text-sm text-seal flex justify-center items-center flex-wrap gap-2 text-center">
                            <span>Tender</span> <span className="text-ink-faint">→</span>
                            <span>Requirements</span> <span className="text-ink-faint">→</span>
                            <span>Documents</span> <span className="text-ink-faint">→</span>
                            <span>Evidence</span> <span className="text-ink-faint">→</span>
                            <span>Verification</span> <span className="text-ink-faint">→</span>
                            <span>Compliance</span> <span className="text-ink-faint">→</span>
                            <span className="font-semibold text-ink">Human Decision</span>
                        </div>

                        <ul className="mb-8 space-y-3 pl-6 text-ink-muted">
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span>Extracts and structures tender requirements.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span>Automatically classifies bidder documents and extracts relevant evidence.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span>Uses deterministic rules for IDs, dates, financial calculations and consistency checks.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span>Matches evidence to individual tender requirements.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span>Provides page-level traceability for every result.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span>Identifies missing, inconsistent, expired and risky evidence.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span>Maintains an immutable audit trail.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span>Keeps the final qualification decision with the procurement officer, rather than automatically accepting or rejecting bidders.</span>
                            </li>
                        </ul>
                    </section>

                    {/* Impact Callout */}
                    <div className="mb-16 rounded-2xl border border-seal/10 bg-seal/5 p-8 backdrop-blur-sm">
                        <h3 className="mb-3 font-serif text-2xl font-semibold text-seal-strong">
                            Impact
                        </h3>
                        <p className="mb-4 text-seal-strong/90 font-medium">
                            From manual document checking → to fast, transparent & auditable compliance verification.
                        </p>
                        <p className="mb-4 text-seal-strong/80 font-mono">
                            ~3 hours → ~18 minutes per bidder (demo)
                        </p>
                        <p className="text-sm font-semibold tracking-wide text-seal uppercase">
                            Evidence-backed decisions | Reduced manual effort | Better auditability
                        </p>
                    </div>

                </motion.article>
            </main>
        </div>
    );
}
