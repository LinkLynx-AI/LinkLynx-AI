"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, X, Lock } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";
import { NitroGate } from "@/shared/ui/legacy/nitro-gate";
import { EMOJI_CATEGORIES, EMOJI_DATA, type EmojiCategoryId } from "./emoji-data";

type EmojiPickerProps = {
  mode: "input" | "reaction";
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: { x: number; y: number };
};

export function EmojiPicker({ mode, onSelect, onClose, position }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryId>("people");
  const [hoveredEmoji, setHoveredEmoji] = useState<{ emoji: string; name: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filteredEmojis = useMemo(() => {
    if (!search) return EMOJI_DATA;
    const lower = search.toLowerCase();
    return EMOJI_DATA.filter(
      (e) =>
        e.name.toLowerCase().includes(lower) ||
        e.emoji.includes(search) ||
        e.keywords?.some((k) => k.toLowerCase().includes(lower)),
    );
  }, [search]);

  const groupedEmojis = useMemo(() => {
    const groups: Record<string, typeof EMOJI_DATA> = {};
    for (const emoji of filteredEmojis) {
      if (!groups[emoji.category]) groups[emoji.category] = [];
      groups[emoji.category].push(emoji);
    }
    return groups;
  }, [filteredEmojis]);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      if (mode === "reaction") {
        onClose();
      }
    },
    [onSelect, onClose, mode],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const scrollToCategory = (categoryId: EmojiCategoryId) => {
    setActiveCategory(categoryId);
    setSearch("");
    const el = gridRef.current?.querySelector(`[data-category="${categoryId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const style = position
    ? { position: "absolute" as const, left: position.x, bottom: position.y }
    : {};

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="絵文字ピッカー"
      className={cn(
        "z-50 flex w-[430px] flex-col rounded-lg",
        "bg-discord-bg-floating shadow-xl",
        "border border-discord-divider",
        !position && "absolute bottom-full right-0 mb-2",
      )}
      style={{ height: 450, ...style }}
    >
      {/* Search */}
      <div className="p-3 pb-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-discord-text-muted" />
          <input
            type="text"
            placeholder="絵文字を検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full rounded-md bg-discord-bg-tertiary py-1.5 pl-9 pr-8",
              "text-sm text-discord-text-normal placeholder:text-discord-text-muted",
              "outline-none",
            )}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-discord-text-muted hover:text-discord-text-normal"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-discord-divider px-1.5 pt-2">
        {EMOJI_CATEGORIES.filter((c) => c.id !== "recent").map((cat) => (
          <button
            key={cat.id}
            onClick={() => scrollToCategory(cat.id)}
            className={cn(
              "shrink-0 px-2 pb-1.5 text-lg transition-colors",
              "hover:bg-discord-bg-mod-hover rounded-t",
              activeCategory === cat.id
                ? "border-b-2 border-discord-brand-blurple"
                : "border-b-2 border-transparent",
            )}
            title={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div ref={gridRef} className="flex-1 overflow-y-auto px-2 py-1">
        {search ? (
          filteredEmojis.length > 0 ? (
            <div className="grid grid-cols-8 gap-0.5">
              {filteredEmojis.map((item) => (
                <button
                  key={item.emoji}
                  onClick={() => handleSelect(item.emoji)}
                  onMouseEnter={() => setHoveredEmoji({ emoji: item.emoji, name: item.name })}
                  onMouseLeave={() => setHoveredEmoji(null)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded",
                    "text-2xl leading-none",
                    "hover:bg-discord-bg-mod-hover transition-colors cursor-pointer",
                  )}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-discord-text-muted">
              一致する絵文字が見つかりません
            </div>
          )
        ) : (
          EMOJI_CATEGORIES.filter((c) => c.id !== "recent").map((cat) => {
            const emojis = groupedEmojis[cat.id];
            if (!emojis?.length) return null;
            const isExternal = cat.id === ("external" as EmojiCategoryId);
            const content = (
              <div key={cat.id} data-category={cat.id}>
                <div className="sticky top-0 bg-discord-bg-floating px-1 py-1.5 text-xs font-semibold uppercase text-discord-text-muted">
                  {cat.name}
                  {isExternal && <Lock className="ml-1 inline h-3 w-3 text-discord-text-muted" />}
                </div>
                <div className="grid grid-cols-8 gap-0.5">
                  {emojis.map((item) => (
                    <button
                      key={item.emoji}
                      onClick={() => handleSelect(item.emoji)}
                      onMouseEnter={() => setHoveredEmoji({ emoji: item.emoji, name: item.name })}
                      onMouseLeave={() => setHoveredEmoji(null)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded",
                        "text-2xl leading-none",
                        "hover:bg-discord-bg-mod-hover transition-colors cursor-pointer",
                      )}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            );
            if (isExternal) {
              return (
                <NitroGate key={cat.id} feature="外部サーバーの絵文字">
                  {content}
                </NitroGate>
              );
            }
            return content;
          })
        )}
      </div>

      {/* Preview */}
      <div className="flex h-12 items-center gap-3 border-t border-discord-divider px-3">
        {hoveredEmoji ? (
          <>
            <span className="text-3xl">{hoveredEmoji.emoji}</span>
            <span className="text-sm text-discord-text-muted">{hoveredEmoji.name}</span>
          </>
        ) : (
          <span className="text-sm text-discord-text-muted">絵文字を選択...</span>
        )}
      </div>
    </div>
  );
}
