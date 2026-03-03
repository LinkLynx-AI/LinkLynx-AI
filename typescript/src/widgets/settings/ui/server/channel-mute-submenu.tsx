"use client";

import { cn } from "@/shared/lib/cn";

const muteOptions = [
  { label: "15分", duration: 900 },
  { label: "1時間", duration: 3600 },
  { label: "8時間", duration: 28800 },
  { label: "24時間", duration: 86400 },
  { label: "ミュート解除まで", duration: null },
] as const;

type ChannelMuteSubmenuProps = {
  onSelect: (duration: number | null) => void;
  currentDuration?: number | null;
};

export function ChannelMuteSubmenu({ onSelect, currentDuration }: ChannelMuteSubmenuProps) {
  return (
    <div className="flex flex-col gap-1" role="radiogroup" aria-label="ミュート期間">
      {muteOptions.map((opt) => {
        const isSelected = currentDuration === opt.duration;
        return (
          <button
            key={opt.label}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(opt.duration)}
            className={cn(
              "flex items-center gap-3 rounded px-3 py-2 text-left text-sm",
              "hover:bg-discord-bg-mod-hover transition-colors",
              isSelected && "bg-discord-bg-mod-selected",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border-2",
                isSelected ? "border-discord-brand-blurple" : "border-discord-interactive-normal",
              )}
            >
              {isSelected && <span className="h-2 w-2 rounded-full bg-discord-brand-blurple" />}
            </span>
            <span className="text-discord-text-normal">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
