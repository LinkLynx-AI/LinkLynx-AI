"use client";

import { useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui/avatar";
import { mockAuditLogEntries } from "@/shared/api/mock/data/audit-log";
import type { AuditLogEntry } from "@/shared/api/mock/data/audit-log";

const actionTypeLabels: Record<AuditLogEntry["actionType"], string> = {
  channel_create: "チャンネルを作成",
  channel_delete: "チャンネルを削除",
  channel_update: "チャンネルを更新",
  role_create: "ロールを作成",
  role_update: "ロールを更新",
  member_kick: "メンバーをキック",
  member_ban: "メンバーをBAN",
  member_unban: "メンバーのBANを解除",
  message_delete: "メッセージを削除",
  invite_create: "招待を作成",
};

const filterCategories = [
  { value: "all", label: "すべて" },
  { value: "channel", label: "チャンネル" },
  { value: "role", label: "ロール" },
  { value: "member", label: "メンバー" },
  { value: "message", label: "メッセージ" },
] as const;

type FilterCategory = (typeof filterCategories)[number]["value"];

function matchesFilter(entry: AuditLogEntry, filter: FilterCategory): boolean {
  if (filter === "all") return true;
  if (filter === "channel") return entry.actionType.startsWith("channel_");
  if (filter === "role") return entry.actionType.startsWith("role_");
  if (filter === "member") return entry.actionType.startsWith("member_");
  if (filter === "message") return entry.actionType.startsWith("message_");
  return true;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}日前`;
  return date.toLocaleDateString("ja-JP");
}

export function ServerAuditLog({ serverId }: { serverId: string }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = mockAuditLogEntries.filter((entry) => {
    if (!matchesFilter(entry, filter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return entry.username.toLowerCase().includes(q) || entry.targetName.toLowerCase().includes(q);
    }
    return true;
  });

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">監査ログ</h2>

      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-discord-text-muted"
          />
          <input
            type="text"
            placeholder="ユーザーまたはターゲットで検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-[3px] bg-discord-input-bg pl-9 pr-3 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterCategory)}
          className="h-10 rounded-[3px] bg-discord-input-bg px-3 text-sm text-discord-text-normal outline-none focus:outline-2 focus:outline-discord-brand-blurple"
        >
          {filterCategories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div className="text-sm text-discord-text-muted mb-3">{filtered.length} 件のログ</div>

      <div>
        {filtered.map((entry) => {
          const isExpanded = expandedIds.has(entry.id);
          const hasDetails = entry.changes || entry.reason;

          return (
            <div key={entry.id} className="border-b border-discord-divider">
              <button
                onClick={() => hasDetails && toggleExpand(entry.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                  hasDetails && "cursor-pointer hover:bg-discord-bg-mod-hover",
                )}
              >
                <Avatar src={entry.userAvatar ?? undefined} alt={entry.username} size={32} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-discord-text-normal">
                    {entry.username}
                  </span>
                  <span className="text-sm text-discord-text-muted"> が </span>
                  <span className="text-sm font-medium text-discord-text-normal">
                    {entry.targetName}
                  </span>
                  <span className="text-sm text-discord-text-muted">
                    {" "}
                    を{actionTypeLabels[entry.actionType]}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-discord-text-muted">
                  {formatRelativeTime(entry.createdAt)}
                </span>
                {hasDetails && (
                  <span className="shrink-0 text-discord-text-muted">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                )}
              </button>

              {isExpanded && hasDetails && (
                <div className="ml-[52px] pb-3 pr-3">
                  {entry.reason && (
                    <p className="text-xs text-discord-text-muted mb-2">理由: {entry.reason}</p>
                  )}
                  {entry.changes && (
                    <div className="rounded bg-discord-bg-secondary p-2">
                      {entry.changes.map((change, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-1">
                          <span className="font-medium text-discord-text-muted">{change.key}:</span>
                          <span className="text-discord-btn-danger line-through">
                            {change.oldValue || "(なし)"}
                          </span>
                          <span className="text-discord-text-muted">→</span>
                          <span className="text-discord-brand-green">
                            {change.newValue || "(なし)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
