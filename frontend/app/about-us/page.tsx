import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa";

export const dynamic = "force-dynamic";

const teamMembers = [
  {
    id: 1,
    name: "Aarushi Hans",
    role: "Frontend Engineer & UI Architecture",
    domain: "Next.js App Router · Institutional Design System · Audit Timelines",
    description:
      "Engineered the institutional interface for public procurement officers, translating complex legal compliance requirements into high-density, accessible checklists and document evidence ledgers.",
    github: "https://github.com/aarushihans",
    linkedin: "https://www.linkedin.com/in/aarushi-hans",
  },
  {
    id: 2,
    name: "Priyanshu Kumar",
    role: "AI & Document Intelligence Engineer",
    domain: "Gemini 2.0 / OpenAI Adapter · OCR Pipeline · Clause Reasoning",
    description:
      "Designed the LLM extraction protocols, prompt schemas, and native PDF ingestion pipeline, implementing schema-constrained extraction without arithmetic hallucinations.",
    github: "https://github.com/PriyanshuKumar-CSE",
    linkedin: "https://www.linkedin.com/in/priyanshukumaar",
  },
  {
    id: 3,
    name: "Pratham Sahu",
    role: "Backend & Systems Engineer",
    domain: "FastAPI Modular Monolith · PostgreSQL Hash Chains · Docker",
    description:
      "Architected the deterministic rule engine, cryptographic SHA-256 append-only audit trail with Postgres triggers, and multi-portal verification adapter layer.",
    github: "https://github.com/prathamsahu31",
    linkedin: "https://linkedin.com/in/prathamsahu31",
  },
  {
    id: 4,
    name: "Arpita Shokeen",
    role: "Compliance & Procurement Domain Specialist",
    domain: "GeM Manuals · CVC Compliance · Clause Codification",
    description:
      "Codified tender eligibility conditions, statutory relaxation rules for MSME/Startups under Public Procurement Policy, and verification criteria for GeM tenders.",
    github: "https://github.com/arpita2shokeen",
    linkedin: "https://www.linkedin.com/in/arpita-shokeen-72968b360",
  },
  {
    id: 5,
    name: "Kshitij Singhal",
    role: "Data Verification & Testing Engineer",
    domain: "PyMuPDF OCR · Bounding Box Locators · Integration Tests",
    description:
      "Built the deterministic locator ladder mapping OCR text spans to exact page bounding boxes, alongside comprehensive pytest coverage across statutory test cases.",
    github: "https://github.com/Kshitij-mit",
    linkedin: "https://www.linkedin.com/in/kshitij-singhal-3a1b9028b/",
  },
  {
    id: 6,
    name: "Kinjal Goel",
    role: "Audit Trail & Evaluation Research",
    domain: "RTI Auditability · Cross-Doc Contradictions · Security",
    description:
      "Researched administrative legal challenges in tender evaluation, developing the cross-document discrepancy detection rules and tamper-evident audit report generation.",
    github: "https://github.com/kinjalgoel597-byte",
    linkedin: "https://www.linkedin.com/in/kinjal-goel-0526b7381",
  },
];

export default function AboutUsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-seal/15 selection:text-seal">
      <SiteHeader />

      <main className="mx-auto max-w-[1140px] px-6 py-12">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-seal transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to overview</span>
          </Link>
        </div>

        {/* Masthead */}
        <header className="border-b border-rule pb-8 mb-10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-seal" />
            <span className="text-[11px] font-mono uppercase font-bold tracking-[0.16em] text-seal">
              Engineering Team · SIH26100
            </span>
          </div>

          <h1 className="mt-2 font-serif text-[32px] sm:text-[38px] font-semibold text-ink leading-tight">
            The Team Behind Vericore
          </h1>

          <p className="mt-3 max-w-[70ch] text-[15px] text-ink-muted leading-relaxed">
            Engineers, systems designers, and procurement domain researchers building evidence-backed bid verification for public sector procurement under the Smart India Hackathon.
          </p>
        </header>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="flex flex-col justify-between rounded-[4px] border border-rule bg-surface p-6 panel-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="font-serif text-[18px] font-semibold text-ink">
                      {member.name}
                    </h2>
                    <p className="text-[12px] font-medium text-seal mt-0.5">
                      {member.role}
                    </p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-surface-muted text-ink font-serif font-bold text-xs border border-rule">
                    {member.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                </div>

                <div className="rounded-[2px] bg-surface-subtle border border-rule-subtle px-2.5 py-1 text-[11px] font-mono text-ink-faint mb-3">
                  {member.domain}
                </div>

                <p className="text-[13px] text-ink-muted leading-relaxed">
                  {member.description}
                </p>
              </div>

              {/* Links */}
              <div className="mt-6 border-t border-rule pt-4 flex items-center gap-3 text-[12px]">
                {member.github && (
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-ink-muted hover:text-seal transition-colors"
                  >
                    <FaGithub size={13} />
                    <span>GitHub</span>
                  </a>
                )}
                {member.linkedin && (
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-ink-muted hover:text-seal transition-colors"
                  >
                    <FaLinkedin size={13} />
                    <span>LinkedIn</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Institutional Affiliation Strip */}
        <div className="mt-12 rounded-[4px] border border-rule bg-surface-subtle p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider font-bold text-ink-faint">
              Client Department & Mentorship
            </p>
            <p className="text-[14px] font-medium text-ink mt-0.5">
              Chennai Petroleum Corporation Limited (CPCL) · Ministry of Petroleum & Natural Gas
            </p>
          </div>
          <Link
            href="/problem-statement"
            className="inline-flex items-center gap-1 rounded-[3px] border border-seal bg-surface px-3.5 py-1.5 text-[12px] font-medium text-seal hover:bg-seal hover:text-white transition-colors shrink-0"
          >
            <span>Read Problem Brief</span>
            <ExternalLink size={12} />
          </Link>
        </div>
      </main>
    </div>
  );
}