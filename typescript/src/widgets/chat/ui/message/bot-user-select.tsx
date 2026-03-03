"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/shared/lib/cn";
import { Search } from "lucide-react";
import { Avatar } from "@/shared/ui/avatar";
import { mockUsers } from "@/shared/api/mock/data/users";
import type { UserSelectComponent } from "@/shared/model/types/bot-components";

export function BotUserSelect({
  component,
  onSelect,
}: {
  component: UserSelectComponent;
  onSelect?: (customId: string, userIds: string[]) => void;
}) {
  const maxValues = component.maxValues ?? 1;
  const isMulti = maxValues > 1;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
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

  const users = mockUsers.filter(
    (u) =>
      !u.bot &&
      (u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())),
  );

  const handleUserClick = (userId: string) => {
    if (component.disabled) return;

    if (isMulti) {
      const newSelected = selected.includes(userId)
        ? selected.filter((id) => id !== userId)
        : selected.length < maxValues
          ? [...selected, userId]
          : selected;
      setSelected(newSelected);
      onSelect?.(component.customId, newSelected);
    } else {
      setSelected([userId]);
      setOpen(false);
      onSelect?.(component.customId, [userId]);
    }
  };

  const displayLabel = () => {
    if (selected.length === 0) {
      return component.placeholder ?? "ユーザーを選択";
    }
    const names = selected
      .map((id) => mockUsers.find((u) => u.id === id)?.displayName)
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
          selected.length > 0 ? "text-discord-text-normal" : "text-discord-text-muted",
          component.disabled && "cursor-not-allowed opacity-50",
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
            className={cn("shrink-0 transition-transform", open && "rotate-180")}
          >
            <path d="M7 10l5 5 5-5H7z" />
          </svg>
        </div>
      </button>
      {open && (
        <div
          className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded bg-discord-bg-floating shadow-xl"
          role="listbox"
        >
          <div className="p-2">
            <div className="flex items-center gap-2 rounded bg-discord-bg-tertiary px-2 py-1.5">
              <Search className="h-4 w-4 shrink-0 text-discord-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="検索"
                className="w-full bg-transparent text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto px-1 pb-1">
            {users.map((user) => {
              const isSelected = selected.includes(user.id);
              return (
                <button
                  key={user.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleUserClick(user.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors",
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
                  <Avatar src={user.avatar ?? undefined} alt={user.displayName} size={16} />
                  <div className="min-w-0 flex-1 text-left">
                    <span className="font-medium">{user.displayName}</span>
                    <span className="ml-1.5 text-xs opacity-60">{user.username}</span>
                  </div>
                </button>
              );
            })}
            {users.length === 0 && (
              <div className="px-2 py-3 text-center text-sm text-discord-text-muted">
                ユーザーが見つかりません
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
