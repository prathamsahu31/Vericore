"use client";

import { useState, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  // Try to extract bidId from URL if we are on a bid page
  const match = pathname?.match(/\/bids\/([0-9a-fA-F-]+)/);
  const bidId = match ? match[1] : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    // Add user question to UI
    const userQ = question;
    setMessages((prev) => [...prev, { role: "user", text: userQ }]);
    setQuestion("");
    setIsLoading(true);

    try {
      // Call our new backend FastAPI endpoint
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bidId ? { bid_id: bidId, question: userQ } : { question: userQ }),
      });

      if (!response.ok) throw new Error("Failed to fetch response");

      const data = await response.json();

      // Add AI answer to UI
      setMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "ai", text: "Sorry, I ran into an error!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* The Chat Window */}
      {isOpen && (
        <div className="mb-4 flex h-[420px] w-[340px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-700 px-4 py-3 text-white">
            <h3 className="font-serif font-semibold tracking-wide text-[16px]">AI Assistant</h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/90 backdrop-blur-md">
            {messages.length === 0 && (
              <p className="mt-8 text-center text-[14px] text-slate-500">
                Ask me anything!
              </p>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-[12px] px-4 py-2.5 text-[14px] leading-relaxed shadow-sm ${msg.role === "user"
                    ? "bg-slate-800 text-white rounded-br-none"
                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                    }`}
                >
                  {msg.text}
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
              className="flex-1 rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
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
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-transform hover:scale-105 hover:bg-slate-800 hover:shadow-xl"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}
