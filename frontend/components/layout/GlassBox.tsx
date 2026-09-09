"use client";

import { useEffect, useRef, useState } from "react";
import { useParallax } from "@/hooks/useParallax";

const MESSAGES = [
    { label: "Turnover threshold", verdict: "Compliant", color: "#79AE6F", text: "2023–24 ₹38.2 Cr" },
    { label: "GST registration", verdict: "Compliant", color: "#79AE6F", text: "PAN matches" },
    { label: "OEM authorisation", verdict: "Your review", color: "#95271D", text: "Requires intervention" },
    { label: "Blacklist declaration", verdict: "No document", color: "#95271D", text: "Ask the bidder" },
];

const PAUSE_TICKS = 3; // extra ticks after all messages before resetting

export default function GlassBox({ isActive = true }: { isActive?: boolean }) {
    const [visibleCount, setVisibleCount] = useState(0);
    const [isIntersecting, setIsIntersecting] = useState(false);
    const sectionRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Parallax hooks for background orb depth and card floating
    const bgOrbParallax = useParallax<HTMLDivElement>({ speed: 0.16 });
    const cardParallax = useParallax<HTMLDivElement>({ speed: -0.05 });

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setIsIntersecting(entry.isIntersecting),
            { threshold: 0.25 }
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (isIntersecting && isActive) {
            intervalRef.current = setInterval(() => {
                setVisibleCount((c) => {
                    if (c >= MESSAGES.length + PAUSE_TICKS) return 0;
                    return c + 1;
                });
            }, 1100);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isIntersecting, isActive]);

    const shownMessages = MESSAGES.slice(0, Math.min(visibleCount, MESSAGES.length));
    const showTyping = visibleCount < MESSAGES.length;

    return (
        <section id="glass-box" className="relative py-7 px-6 overflow-hidden" ref={sectionRef}>
            <div className="max-w-6xl ">
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-16 items-center">
                    {/* ── Right: animated panel with parallax float ── */}
                    <div
                        ref={cardParallax.ref}
                        className="rounded-2xl border border-black/[0.08] bg-white/[0.1] backdrop-blur overflow-hidden transition-shadow duration-300"
                        style={{
                            ...cardParallax.style,
                            boxShadow:
                                "0 0 60px rgba(16,185,129,0.04), 0 24px 48px rgba(223, 219, 219, 0.15)",
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2">
                                <span className="text-s font-medium text-black-300">
                                    Vericore
                                </span>
                            </div>
                            <span className="text-[10px] text-zinc-600">
                                Watch it work
                            </span>
                        </div>

                        {/* Message feed */}
                        <div className="p-5 min-h-[300px] space-y-4 flex flex-col">
                            {shownMessages.map((msg, i) => (
                                <div
                                    key={`${i}-${visibleCount <= MESSAGES.length ? "a" : "b"}`}
                                    className="flex gap-3"
                                    style={{ animation: "fade-up 0.4s ease both" }}
                                >
                                    <div
                                        className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: msg.color }}
                                    />
                                    <div>
                                        <span
                                            className="text-xs font-semibold"
                                            style={{ color: msg.color }}
                                        >
                                            {msg.label}
                                        </span>
                                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                                            {msg.text}
                                        </p>
                                        <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                                            {msg.verdict}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {/* Typing dots */}
                            {showTyping && (
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 flex-shrink-0" />
                                    <div className="flex items-center gap-1.5">
                                        {[0, 1, 2].map((i) => (
                                            <span
                                                key={i}
                                                className="w-1.5 h-1.5 rounded-full bg-zinc-600"
                                                style={{
                                                    animation:
                                                        "typing-bounce 1.2s ease-in-out infinite",
                                                    animationDelay: `${i * 0.16}s`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
