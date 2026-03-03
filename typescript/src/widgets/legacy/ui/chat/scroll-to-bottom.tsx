"use client";

import { ArrowDown } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";

export function ScrollToBottom({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute bottom-20 right-4 z-10",
        "flex h-10 w-10 items-center justify-center rounded-full",
        "bg-discord-bg-floating shadow-lg",
        "text-discord-text-normal hover:text-discord-interactive-hover",
        "transition-colors",
      )}
    >
      <ArrowDown className="h-5 w-5" />
    </button>
  );
}
