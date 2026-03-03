"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Hash, Volume2 } from "lucide-react";
import type { ChannelSelectComponent } from "@/types/bot-components";

interface MockChannel {
  id: string;
  name: string;
  type: number; // 0 = text, 2 = voice
  category: string;
}

const mockChannels: MockChannel[] = [
  { id: "ch-1", name: "一般", type: 0, category: "テキストチャンネル" },
  { id: "ch-2", name: "開発", type: 0, category: "テキストチャンネル" },
  { id: "ch-3", name: "デザイン", type: 0, category: "テキストチャンネル" },
  { id: "ch-4", name: "雑談", type: 0, category: "テキストチャンネル" },
  { id: "ch-5", name: "ボイスチャット", type: 2, category: "ボイスチャンネル" },
  { id: "ch-6", name: "ミーティング", type: 2, category: "ボイスチャンネル" },
];

export function BotChannelSelect({
  component,
  onSelect,
}: {
  component: ChannelSelectComponent;
  onSelect?: (customId: string, channelIds: string[]) => void;
}) {
  const maxValues = component.maxValues ?? 1;
  const isMulti = maxValues > 1;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
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

  const filteredChannels = component.channelTypes
    ? mockChannels.filter((ch) => component.channelTypes!.includes(ch.type))
    : mockChannels;

  const grouped = filteredChannels.reduce<Record<string, MockChannel[]>>(
    (acc, ch) => {
      if (!acc[ch.category]) acc[ch.category] = [];
      acc[ch.category].push(ch);
      return acc;
    },
    {}
  );

  const handleChannelClick = (channelId: string) => {
    if (component.disabled) return;

    if (isMulti) {
      const newSelected = selected.includes(channelId)
        ? selected.filter((id) => id !== channelId)
        : selected.length < maxValues
          ? [...selected, channelId]
          : selected;
      setSelected(newSelected);
      onSelect?.(component.customId, newSelected);
    } else {
      setSelected([channelId]);
      setOpen(false);
      onSelect?.(component.customId, [channelId]);
    }
  };

  const displayLabel = () => {
    if (selected.length === 0) {
      return component.placeholder ?? "チャンネルを選択";
    }
    const names = selected
      .map((id) => mockChannels.find((ch) => ch.id === id)?.name)
      .filter(Boolean);
    return names.join(", ");
  };

  return (
    <div ref={ref} className="relative max-w-[400px]">
      <button
        onClick={() => !component.disabled && setOpen(!open)}
        disabled={component.disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-[3px] bg-discord-input-bg px-3 py-2 text-sm transition-colors",
          selected.length > 0
            ? "text-discord-text-normal"
            : "text-discord-text-muted",
          component.disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="truncate">{displayLabel()}</span>
        <div className="flex items-center gap-1.5">
          {isMulti && selected.length > 0 && (
            <span className="text-xs text-discord-text-muted">
              {selected.length}/{maxValues}
            </span>
          )}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={cn(
              "shrink-0 transition-transform",
              open && "rotate-180"
            )}
          >
            <path d="M7 10l5 5 5-5H7z" />
          </svg>
        </div>
      </button>
      {open && (
        <div
          className="absolute top-full z-50 mt-1 w-full overflow-y-auto rounded bg-discord-bg-floating py-1 shadow-xl"
          style={{ maxHeight: 300 }}
          role="listbox"
        >
          {Object.entries(grouped).map(([category, channels]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-xs font-bold uppercase text-discord-header-secondary">
                {category}
              </div>
              {channels.map((channel) => {
                const isSelected = selected.includes(channel.id);
                return (
                  <button
                    key={channel.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleChannelClick(channel.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors",
                      "text-discord-text-normal hover:bg-discord-brand-blurple hover:text-white",
                      isSelected && "bg-discord-bg-mod-selected"
                    )}
                  >
                    {isMulti && (
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                          isSelected
                            ? "border-discord-brand-blurple bg-discord-brand-blurple"
                            : "border-discord-text-muted"
                        )}
                      >
                        {isSelected && (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="white"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </span>
                    )}
                    {channel.type === 2 ? (
                      <Volume2 className="h-4 w-4 shrink-0 opacity-60" />
                    ) : (
                      <Hash className="h-4 w-4 shrink-0 opacity-60" />
                    )}
                    <span>{channel.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
