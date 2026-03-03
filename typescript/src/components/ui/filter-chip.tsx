"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function FilterChip({
  label,
  onRemove,
  color,
  icon,
}: {
  label: string;
  onRemove: () => void;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-white",
        color || "bg-discord-brand-blurple/20",
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="shrink-0 rounded-full p-0.5 hover:bg-white/10"
        aria-label={`${label} を削除`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
