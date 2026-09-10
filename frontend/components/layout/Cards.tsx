"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MoreHorizontal, Copy } from "lucide-react";

/* --- Types --- */
export interface CarouselCard {
    id: string;
    title: string;
    value: string;
    color: string;
}

interface MinimalCarouselProps {
    cards: CarouselCard[];
    onCopyClick?: (card: CarouselCard) => void;
    onCustomizeClick?: (card: CarouselCard) => void;
}

export const MinimalCarousel: React.FC<MinimalCarouselProps> = ({
    cards,
    onCopyClick,
    onCustomizeClick,
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const activeCard = cards.find((c) => c.id === activeId);
    const secondaryCards = cards.filter((c) => c.id !== activeId);

    const handleBackgroundClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) setActiveId(null);
    };

    return (
        <div className="min-h-full w-full flex items-center justify-center bg-transparent">
            <div
                className="w-full flex flex-col items-center justify-center px-3 sm:px-4 select-none font-sans"
                onClick={handleBackgroundClick}
            >
                {/* Container  */}
                <div className="w-full max-w-105">
                    <motion.div layout className="flex flex-col gap-3">

                        {/* Expanded Card */}
                        <AnimatePresence mode="popLayout">
                            {activeCard && (
                                <motion.div
                                    key={activeCard.id}
                                    layoutId={activeCard.id}
                                    className={`relative flex w-full flex-col justify-between
                             rounded-[28px] sm:rounded-[32px] p-4 sm:p-5 text-white shadow-2xl
                             border border-black/[0.08] bg-white/[0.1] backdrop-blur-md
                             min-h-42.5 sm:h-48`}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                >
                                    <div className="flex items-start justify-between gap-100">


                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            type="button"
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                onCopyClick?.(activeCard);
                                            }}
                                            className="flex items-center gap-1.5 rounded-full bg-white/800
                                 px-3 py-1.5 sm:px-4 sm:py-2 font-bold backdrop-blur-md 
                                 text-xs sm:text-base whitespace-nowrap
                                 hover:bg-white/200 transition-colors"
                                        >
                                            Copy <span className="hidden xs:inline">Address</span> <Copy size={16} />
                                        </motion.button>
                                    </div>

                                    <div className="flex items-end justify-between mt-4">
                                        <div className="overflow-hidden mr-2">
                                            <h3 className="text-xl sm:text-2xl font-semibold opacity-90 leading-tight truncate">
                                                {activeCard.title}
                                            </h3>
                                            <p className="text-lg sm:text-xl font-semibold tracking-tight opacity-60 truncate">
                                                {activeCard.value}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                onCustomizeClick?.(activeCard);
                                            }}
                                            className="rounded-full bg-white/30 px-3 py-1 sm:px-4 sm:py-1.5
                                 text-sm sm:text-base font-bold backdrop-blur-md 
                                 hover:bg-white/40 transition-colors shrink-0"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Grid Layout */}
                        <motion.div
                            layout
                            className={`grid gap-2 sm:gap-3 transition-all duration-500 ${activeId ? "grid-cols-3" : "grid-cols-1"
                                }`}
                        >
                            {(activeId ? secondaryCards : cards).map((card) => (
                                <motion.div
                                    key={card.id}
                                    layoutId={card.id}
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setActiveId(card.id);
                                    }}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    className={`relative flex flex-col justify-between cursor-pointer
                             rounded-[22px] sm:rounded-[28px] p-3 sm:p-4 text-white shadow-lg
                             border border-black/[0.08] bg-white/[0.1] backdrop-blur-md hover:bg-indigo-600/30 transition-colors duration-300 ease-in-out

                             ${activeId ? "h-24 sm:h-28" : "h-28 sm:h-32"}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="rounded-full bg-white/10 p-1 sm:p-1.5 transition-colors">
                                            <MoreHorizontal size={16} />
                                        </div>
                                    </div>

                                    <div className="mt-1 overflow-hidden">
                                        <h4 className={`${activeId ? "text-[10px] sm:text-xs" : "text-sm sm:text-base"} 
                                   font-medium opacity-90 truncate leading-tight`}>
                                            {card.title}
                                        </h4>
                                        <p className={`${activeId ? "text-[10px] sm:text-xs" : "text-sm sm:text-base"} 
                                   font-semibold text-white/60 truncate`}>
                                            {card.value}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};