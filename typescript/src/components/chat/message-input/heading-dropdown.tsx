"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface HeadingDropdownProps {
  onSelect: (level: 1 | 2 | 3) => void;
  onClose: () => void;
}

const HEADINGS = [
  { level: 1 as const, label: "見出し1", className: "text-xl font-bold" },
  { level: 2 as const, label: "見出し2", className: "text-lg font-bold" },
  { level: 3 as const, label: "見出し3", className: "text-base font-semibold" },
];

export function HeadingDropdown({ onSelect, onClose }: HeadingDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute bottom-full left-0 z-50 mb-2",
        "w-48 rounded-lg bg-discord-bg-floating py-1.5 shadow-xl",
        "border border-discord-bg-mod-faint"
      )}
    >
      {HEADINGS.map(({ level, label, className }) => (
        <button
          key={level}
          type="button"
          onClick={() => {
            onSelect(level);
            onClose();
          }}
          className={cn(
            "w-full px-3 py-1.5 text-left text-discord-text-normal",
            "hover:bg-discord-bg-mod-hover transition-colors",
            className
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
