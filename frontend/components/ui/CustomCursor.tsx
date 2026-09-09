"use client";

import { useEffect, useState } from "react";

export function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseEnter = () => setHidden(false);
    const handleMouseLeave = () => setHidden(true);

    window.addEventListener("mousemove", updatePosition);
    window.addEventListener("mouseenter", handleMouseEnter);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", updatePosition);
      window.removeEventListener("mouseenter", handleMouseEnter);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className="pointer-events-none fixed z-[9999] rounded-full bg-[#8CC0EB]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '12px',
        height: '12px',
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 0 15px 5px rgba(201, 235, 240, 0.7)',
        transition: 'width 0.2s, height 0.2s',
      }}
    />
  );
}
