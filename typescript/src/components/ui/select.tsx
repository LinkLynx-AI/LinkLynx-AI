"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled,
  className,
}: {
  options: { value: string; label: string }[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-[3px] bg-discord-input-bg px-3 text-sm transition-colors",
          selected ? "text-discord-text-normal" : "text-discord-text-muted",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span>{selected?.label ?? placeholder}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={cn("transition-transform", open && "rotate-180")}
        >
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full z-50 mt-1 w-full rounded bg-discord-bg-floating py-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center px-3 py-2 text-sm text-discord-text-normal transition-colors hover:bg-discord-brand-blurple hover:text-white",
                option.value === value && "bg-discord-bg-mod-selected"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
