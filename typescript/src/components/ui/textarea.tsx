"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export function Textarea({
  label,
  error,
  fullWidth,
  className,
  disabled,
  onChange,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  useEffect(() => {
    autoResize();
  }, [props.value]);

  return (
    <div className={cn(fullWidth && "w-full")}>
      {label && (
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          "min-h-[40px] rounded-[3px] bg-discord-input-bg px-3 py-2 text-discord-text-normal placeholder:text-discord-text-muted outline-none transition-colors resize-none",
          error
            ? "outline-2 outline-discord-brand-red"
            : "focus:outline-2 focus:outline-discord-brand-blurple",
          disabled && "opacity-50 cursor-not-allowed",
          fullWidth ? "w-full" : "w-auto",
          className,
        )}
        disabled={disabled}
        onChange={(e) => {
          autoResize();
          onChange?.(e);
        }}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-discord-brand-red">{error}</p>}
    </div>
  );
}
