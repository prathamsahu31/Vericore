"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="mb-6 flex items-center gap-2 rounded-[4px] border border-rule bg-surface/50 px-4 py-2 text-[14px] font-medium text-ink-muted transition-colors hover:border-seal hover:text-seal backdrop-blur-sm w-fit"
    >
      <ArrowLeft size={16} />
      Back
    </button>
  );
}
