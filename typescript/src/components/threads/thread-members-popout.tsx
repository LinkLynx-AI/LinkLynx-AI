"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { X, UserPlus, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export interface ThreadMember {
  userId: string;
  displayName: string;
  avatar: string | null;
}

export function ThreadMembersPopout({
  threadId,
  members,
  onAddMember,
  onRemoveMember,
  onClose,
}: {
  threadId: string;
  members: ThreadMember[];
  onAddMember?: () => void;
  onRemoveMember?: (userId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = members.filter((m) =>
    m.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={ref}
      className={cn(
        "absolute right-0 top-full z-50 mt-1 w-[280px]",
        "rounded-lg bg-discord-bg-floating shadow-xl"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-discord-divider px-4 py-3">
        <h3 className="text-sm font-semibold text-discord-header-primary">
          メンバー — {members.length}
        </h3>
        <button
          onClick={onClose}
          className="text-discord-interactive-normal hover:text-discord-interactive-hover transition-colors"
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded bg-discord-bg-tertiary px-2 py-1.5">
          <Search className="h-4 w-4 shrink-0 text-discord-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="検索"
            className="w-full bg-transparent text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none"
          />
        </div>
      </div>

      {/* Member list */}
      <div className="max-h-[240px] overflow-y-auto px-2 pb-2">
        {filtered.map((member) => (
          <div
            key={member.userId}
            className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-discord-bg-mod-hover"
          >
            <Avatar
              src={member.avatar ?? undefined}
              alt={member.displayName}
              size={32}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-discord-text-normal">
              {member.displayName}
            </span>
            {onRemoveMember && (
              <button
                onClick={() => onRemoveMember(member.userId)}
                className="hidden shrink-0 text-discord-interactive-normal hover:text-discord-interactive-hover group-hover:block transition-colors"
                aria-label={`${member.displayName}を削除`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-3 text-center text-sm text-discord-text-muted">
            メンバーが見つかりません
          </div>
        )}
      </div>

      {/* Add member button */}
      {onAddMember && (
        <div className="border-t border-discord-divider px-3 py-2">
          <button
            onClick={onAddMember}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded py-2",
              "bg-discord-brand-blurple text-sm font-medium text-white",
              "hover:bg-discord-btn-blurple-hover transition-colors"
            )}
          >
            <UserPlus className="h-4 w-4" />
            メンバーを追加
          </button>
        </div>
      )}
    </div>
  );
}
