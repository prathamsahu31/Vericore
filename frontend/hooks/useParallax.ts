"use client";

import { useEffect, useRef, useState } from "react";

interface UseParallaxOptions {
    /**
     * Parallax speed multiplier.
     * Positive value moves element in the scroll direction (slower than scroll).
     * Negative value moves element in the opposite scroll direction.
     * e.g., 0.15 for subtle background depth, -0.08 for floating cards.
     */
    speed?: number;
    /**
     * Disable parallax effect on mobile screens (< 768px) for performance.
     * Defaults to true.
     */
    disableOnMobile?: boolean;
}

export function useParallax<T extends HTMLElement = HTMLDivElement>({
    speed = 0.15,
    disableOnMobile = true,
}: UseParallaxOptions = {}) {
    const ref = useRef<T | null>(null);
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        // SSR check
        if (typeof window === "undefined") return;

        // Check prefers-reduced-motion preference
        const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (motionQuery.matches) return;

        // Check mobile screens if set to disable
        if (disableOnMobile && window.innerWidth < 768) return;

        let animationFrameId: number;

        const handleScroll = () => {
            if (!ref.current) return;

            const rect = ref.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            // Calculate how far the center of the element is from the center of the viewport
            const elementCenter = rect.top + rect.height / 2;
            const viewportCenter = windowHeight / 2;
            const distanceFromCenter = elementCenter - viewportCenter;

            // Apply offset proportional to speed
            const calculatedOffset = distanceFromCenter * speed * -1;

            setOffset(calculatedOffset);
        };

        const onScroll = () => {
            animationFrameId = requestAnimationFrame(handleScroll);
        };

        // Initial positioning check
        handleScroll();

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", handleScroll);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [speed, disableOnMobile]);

    return { ref, offset, style: { transform: `translate3d(0, ${offset.toFixed(2)}px, 0)`, willChange: "transform" } };
}
