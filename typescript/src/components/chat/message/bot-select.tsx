"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import type { SelectMenuComponent, SelectOption } from "@/types/bot-components";

export function BotSelect({
  component,
  onSelect,
}: {
  component: SelectMenuComponent;
  onSelect?: (customId: string, values: string[]) => void;
}) {
  const isMulti = (component.maxValues ?? 1) > 1;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(
    component.options.filter((o) => o.default).map((o) => o.value),
  );
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

  const handleOptionClick = (option: SelectOption) => {
    if (component.disabled) return;

    if (isMulti) {
      const newSelected = selected.includes(option.value)
        ? selected.filter((v) => v !== option.value)
        : [...selected, option.value];
      setSelected(newSelected);
      onSelect?.(component.customId, newSelected);
    } else {
      setSelected([option.value]);
      setOpen(false);
      onSelect?.(component.customId, [option.value]);
    }
  };

  const displayLabel = () => {
    if (selected.length === 0) {
      return component.placeholder ?? "選択してください";
    }
    const labels = selected
      .map((v) => component.options.find((o) => o.value === v)?.label)
      .filter(Boolean);
    return labels.join(", ");
  };

  return (
    <div ref={ref} className="relative max-w-[400px]">
      <button
        onClick={() => !component.disabled && setOpen(!open)}
        disabled={component.disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-[3px] bg-discord-input-bg px-3 py-2 text-sm transition-colors",
          selected.length > 0 ? "text-discord-text-normal" : "text-discord-text-muted",
          component.disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="truncate">{displayLabel()}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        >
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full z-50 mt-1 w-full overflow-y-auto rounded bg-discord-bg-floating py-1 shadow-xl"
          style={{ maxHeight: 256 }}
          role="listbox"
        >
          {component.options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleOptionClick(option)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                  "text-discord-text-normal hover:bg-discord-brand-blurple hover:text-white",
                  isSelected && "bg-discord-bg-mod-selected",
                )}
              >
                {isMulti && (
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                      isSelected
                        ? "border-discord-brand-blurple bg-discord-brand-blurple"
                        : "border-discord-text-muted",
                    )}
                  >
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                  </span>
                )}
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    {option.emoji && <span>{option.emoji.name}</span>}
                    <span>{option.label}</span>
                  </div>
                  {option.description && (
                    <div className="text-xs text-discord-text-muted">{option.description}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
