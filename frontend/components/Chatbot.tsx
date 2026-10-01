"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { MessageCircle, X, Send, Loader2, TriangleAlert, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_BASE } from "@/lib/api";
import { Identifier } from "@/components/ui/status";

type ChatSource = { document: string; page: number | null };
type ChatPoint = { text: string; sources: ChatSource[] };
type ChatSection = { heading: string; points: ChatPoint[] };
type ChatLink = { entity: string; label: string; href: string };

// `notices` are facts the server established, such as verdicts being out of
// date, attached after the model answered so the model cannot leave them out.
// `links` are pages for the tenders and bids the answer names, matched by the
// server against real records, so they never point at an invented ID.
type ChatAnswer = {
  summary: string;
  sections: ChatSection[];
  injection_suspected: boolean;
  notices?: string[];
  links?: ChatLink[];
};

// An AI message carries `answer` when it came back from the model; errors, and
// history saved before answers were structured, carry only `text`.
type Message = { role: "user"; text: string } | { role: "ai"; text: string; answer?: ChatAnswer };

const STORAGE_KEY = "vericore-chat-history";

// GSTIN, CIN, Udyam URN and PAN, longest first so a GSTIN is not split at the
// PAN inside it. Matches are monospaced, as every identifier is (CLAUDE.md §11).
const IDENTIFIER =
  /(UDYAM-[A-Z]{2}-\d{2}-\d{7}|\b[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b|\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b|\b[A-Z]{5}\d{4}[A-Z]\b)/;

function withIdentifiers(text: string): ReactNode[] {
  // split() with a capturing group puts each match at an odd index.
  return text
    .split(IDENTIFIER)
    .map((part, i) => (i % 2 === 1 ? <Identifier key={i} value={part} /> : part));
}

function LinksView({ links }: { links: ChatLink[] }) {
  // One row per tender or bidder, keeping the order the server sent.
  const groups = new Map<string, ChatLink[]>();
  for (const link of links) groups.set(link.entity, [...(groups.get(link.entity) ?? []), link]);
  return (
    <nav aria-label="Pages named in this answer" className="space-y-2 border-t border-rule pt-2.5">
      {[...groups].map(([entity, group]) => (
        <div key={entity}>
          <p className="truncate text-[12px] text-ink-muted" title={entity}>
            {entity}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {group.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-[6px] border border-seal px-2 py-1 text-[12px] font-medium text-seal hover:bg-seal-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
              >
                {link.label}
                <ArrowRight size={12} aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AnswerView({ answer }: { answer: ChatAnswer }) {
  return (
    <div className="space-y-3">
      {answer.notices?.map((notice) => (
        <p
          key={notice}
          className="flex items-start gap-1.5 rounded-[6px] border border-review px-2.5 py-1.5 text-[13px] text-review"
        >
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      ))}
      {answer.injection_suspected && (
        <p className="flex items-start gap-1.5 rounded-[6px] border border-review px-2.5 py-1.5 text-[13px] text-review">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          A document contains text addressed to the assistant. It was ignored. Review the
          document.
        </p>
      )}
      <p className="text-[14px] leading-relaxed text-ink">{withIdentifiers(answer.summary)}</p>
      {answer.sections.map((section, i) => (
        <section key={`${section.heading}-${i}`} className="border-t border-rule pt-2.5">
          <h4 className="mb-1.5 text-[13px] font-semibold text-ink">{section.heading}</h4>
          <ul className="space-y-2">
            {section.points.map((point, j) => (
              <li key={j} className="flex gap-2 text-[13px] leading-snug text-ink">
                <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                <span>
                  {withIdentifiers(point.text)}
                  {point.sources.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {point.sources.map((source, k) => (
                        <span
                          key={k}
                          className="rounded-[4px] border border-rule bg-paper px-1.5 py-px font-mono text-[11px] text-ink-muted"
                        >
                          {source.document}
                          {source.page != null && ` · p.${source.page}`}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {answer.links && answer.links.length > 0 && <LinksView links={answer.links} />}
    </div>
  );
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  // The page decides what the assistant can see: a bid page sends the bid, a
  // tender page the tender, anywhere else the backend uses the open tenders.
  const bidId = pathname?.match(/\/bids\/([0-9a-fA-F-]{36})/)?.[1];
  const tenderId = bidId ? undefined : pathname?.match(/\/tenders\/([0-9a-fA-F-]{36})/)?.[1];
  const scope = bidId
    ? { label: "this bid", hint: "Ask about this bid's documents, verdicts and findings." }
    : tenderId
      ? { label: "this tender", hint: "Ask about this tender, its requirements and its bids." }
      : { label: "open tenders", hint: "Open a tender or bid to ask about it in detail." };

  // Restore chat history from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      // sessionStorage unavailable or corrupt — start fresh
    }
  }, []);

  // Persist chat history to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // storage full or unavailable — silently skip
    }
  }, [messages]);

  // Auto-scroll to the latest message
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userQ = question;
    setMessages((prev) => [...prev, { role: "user", text: userQ }]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bid_id: bidId, tender_id: tenderId, question: userQ }),
      });

      if (!response.ok) {
        // Try to extract the backend's error detail
        const errBody = await response.json().catch(() => null);
        const detail = errBody?.detail || `Server error (${response.status})`;
        throw new Error(detail);
      }

      const answer: ChatAnswer = await response.json();
      setMessages((prev) => [...prev, { role: "ai", text: answer.summary, answer }]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "ai", text: `Error: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* The Chat Window */}
      {isOpen && (
        <div className="mb-4 flex h-[520px] max-h-[calc(100vh-7rem)] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-700 px-4 py-3 text-white">
            <div>
              <h3 className="font-serif font-semibold tracking-wide text-[16px]">AI Assistant</h3>
              <p className="text-[11px] text-slate-300">Answering about {scope.label}</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-slate-300 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat History */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/90 backdrop-blur-md">
            {messages.length === 0 && (
              <p className="mt-8 text-center text-[14px] text-slate-500">{scope.hint}</p>
            )}
            {messages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rounded-[12px] px-4 py-2.5 text-[14px] leading-relaxed shadow-sm ${msg.role === "user"
                    ? "max-w-[85%] bg-slate-800 text-white rounded-br-none"
                    : "w-full bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                    }`}
                >
                  {msg.role === "ai" && msg.answer ? <AnswerView answer={msg.answer} /> : msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 text-slate-800 rounded-[12px] rounded-bl-none px-4 py-3 shadow-sm">
                  <Loader2 size={16} className="animate-spin text-slate-800" />
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-slate-50 p-3 flex gap-2 items-end">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              aria-label="Chat message"
              className="flex-1 rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              aria-label="Send message"
              className="flex h-[40px] w-[40px] items-center justify-center rounded-[8px] bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-70 transition-colors shadow-sm"
            >
              <Send size={16} className="ml-1" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Assistant"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-transform hover:scale-105 hover:bg-slate-800 hover:shadow-xl"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}
