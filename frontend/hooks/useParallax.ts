import { useEffect, useState, useRef } from "react";

export function useParallax<T extends HTMLElement>({ speed = 0 }: { speed?: number }) {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setOffset(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return {
    ref,
    style: {
      transform: `translateY(${offset * speed}px)`,
    },
  };
}
