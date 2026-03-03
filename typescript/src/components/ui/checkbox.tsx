"use client";

import { cn } from "@/lib/cn";

export function Checkbox({
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
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-[4px] transition-colors",
        checked
          ? "bg-discord-brand-blurple"
          : "border border-discord-interactive-normal bg-transparent",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {checked && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M8.99991 16.17L4.82991 12L3.40991 13.41L8.99991 19L20.9999 7.00003L19.5899 5.59003L8.99991 16.17Z"
            fill="white"
          />
        </svg>
      )}
    </button>
  );
}
