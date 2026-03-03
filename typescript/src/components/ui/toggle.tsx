"use client";

import { cn } from "@/lib/cn";

export function Toggle({
  checked,
  onChange,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 rounded-full transition-colors",
        checked ? "bg-discord-brand-green" : "bg-discord-interactive-muted",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  );
}
