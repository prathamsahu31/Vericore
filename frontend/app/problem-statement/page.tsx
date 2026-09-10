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

                    {/* Main Title (H1 equivalent) */}
                    <h1 className="mb-12 font-serif text-5xl font-semibold leading-tight tracking-tight text-ink md:text-6xl lg:text-7xl">
                        The Problem Statement
                    </h1>

                    {/* Introduction / Lead Paragraph */}
                    <p className="mb-12 text-xl leading-relaxed text-ink-muted sm:text-2xl">
                        This is the lead paragraph. It should be used to provide a high-level executive summary of the problem you are solving. Make it punchy, clear, and impactful.
                    </p>

                    {/* Section 1 */}
                    <section className="mb-16">
                        <h2 className="mb-6 font-serif text-3xl font-semibold text-ink">
                            1. The Core Challenge
                        </h2>
                        <p className="mb-6 leading-relaxed text-ink-muted">
                            Here you can explain the core challenge in detail. Use standard paragraphs to break down the complexities of the issue. The current system relies heavily on manual verification, which introduces several critical failure points:
                        </p>

                        {/* Unordered List */}
                        <ul className="mb-8 space-y-3 pl-6 text-ink-muted">
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span><strong>Inefficiency:</strong> Manual verification takes hours per document.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span><strong>Human Error:</strong> High volume of documents leads to fatigue and mistakes in compliance checking.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal"></span>
                                <span><strong>Scalability:</strong> As the number of tenders increases, the workforce cannot scale linearly.</span>
                            </li>
                        </ul>
                    </section>

                    {/* Glass Callout Box */}
                    <div className="mb-16 rounded-2xl border border-seal/10 bg-seal/5 p-8 backdrop-blur-sm">
                        <h3 className="mb-3 font-serif text-xl font-semibold text-seal-strong">
                            Key Objective
                        </h3>
                        <p className="text-seal-strong/80">
                            "To automate the compliance verification of bidder-submitted evidence against tender-specific requirements, reducing processing time by 90% while maintaining 100% accuracy."
                        </p>
                    </div>

                    {/* Section 2 with Subsections */}
                    <section className="mb-16">
                        <h2 className="mb-6 font-serif text-3xl font-semibold text-ink">
                            2. Proposed Architecture
                        </h2>
                        <p className="mb-6 leading-relaxed text-ink-muted">
                            Describe how your solution approaches the problem. You can use smaller headings to break this down further.
                        </p>

                        <h3 className="mb-4 font-serif text-xl font-medium text-ink">
                            Data Extraction Pipeline
                        </h3>
                        <p className="mb-8 leading-relaxed text-ink-muted">
                            Detail the data extraction pipeline here. Explain how OCR and LLMs are utilized to parse unstructured documents into structured JSON formats.
                        </p>

                        <h3 className="mb-4 font-serif text-xl font-medium text-ink">
                            Verification Logic
                        </h3>
                        {/* Ordered List */}
                        <ol className="mb-8 list-inside list-decimal space-y-3 text-ink-muted marker:font-semibold marker:text-seal">
                            <li>Extract requirements from the Notice Inviting Tender (NIT).</li>
                            <li>Parse bidder documents into standardized schemas.</li>
                            <li>Run deterministic checks across required constraints.</li>
                            <li>Flag anomalies for human-in-the-loop review.</li>
                        </ol>
                    </section>

                    {/* Technical Specifications */}
                    <section className="mb-16">
                        <h2 className="mb-6 font-serif text-3xl font-semibold text-ink">
                            3. Technical Constraints
                        </h2>
                        <div className="overflow-hidden rounded-xl border border-rule bg-white shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-rule bg-surface/50">
                                    <tr>
                                        <th className="px-6 py-4 font-medium text-ink">Requirement</th>
                                        <th className="px-6 py-4 font-medium text-ink">Specification</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-rule text-ink-muted">
                                    <tr>
                                        <td className="px-6 py-4 font-mono text-[13px]">Processing Speed</td>
                                        <td className="px-6 py-4">{'< 5 seconds per document'}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4 font-mono text-[13px]">Accuracy Threshold</td>
                                        <td className="px-6 py-4">99.9% deterministic accuracy</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4 font-mono text-[13px]">Supported Formats</td>
                                        <td className="px-6 py-4">PDF, JPG, PNG, DOCX</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                </motion.article>
            </main>
        </div>
    );
}
