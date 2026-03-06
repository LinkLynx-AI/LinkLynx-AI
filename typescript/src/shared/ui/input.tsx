"use client";

import { cn } from "@/shared/lib/cn";

export function Input({
  label,
  error,
  fullWidth,
  className,
  disabled,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn(fullWidth && "w-full")}>
      {label && (
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          {label}
        </label>
      )}
      <input
        className={cn(
          "h-10 rounded-[3px] bg-discord-input-bg px-3 text-discord-text-normal placeholder:text-discord-text-muted outline-none transition-colors",
          error
            ? "outline-2 outline-discord-brand-red"
            : "focus:outline-2 focus:outline-discord-brand-blurple",
          disabled && "opacity-50 cursor-not-allowed",
          fullWidth ? "w-full" : "w-auto",
          className,
        )}
        disabled={disabled}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-discord-brand-red">{error}</p>}
    </div>
  );
}
