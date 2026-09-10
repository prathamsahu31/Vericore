"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="mb-6 flex items-center justify-center rounded-[4px] border border-rule bg-surface/50 p-2 text-ink-muted transition-colors hover:border-seal hover:text-seal backdrop-blur-sm w-fit"
      aria-label="Go back"
    >
      <ArrowLeft size={20} />
    </button>
  );
}
