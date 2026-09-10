"use client";

import { Trash2 } from "lucide-react";
import { deleteTender } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteTenderButton({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this tender?")) return;
    setIsDeleting(true);
    try {
      await deleteTender(tenderId);
      router.refresh();
    } catch (e) {
      alert("Failed to delete tender");
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="flex items-center justify-center rounded-[4px] border border-rule px-3 py-2 text-ink-muted transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-50"
      title="Delete tender"
    >
      <Trash2 size={16} />
    </button>
  );
}
