"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";
import { useGuildStore } from "@/shared/model/legacy/stores/guild-store";
import { useSearchMessages } from "./use-search-messages";
import { Avatar } from "@/shared/ui/legacy";
import { EmptyState } from "@/shared/ui/legacy/empty-state";

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SearchPanel() {
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "relevant">("recent");
  const serverId = useGuildStore((s) => s.activeServerId);

  const { data: results, isLoading } = useSearchMessages(serverId ?? "", {
    content: searchInput,
  });

  const messages = results?.messages.flat() ?? [];

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-discord-text-muted" />
          <input
            type="text"
            placeholder="メッセージを検索"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(
              "w-full rounded-md bg-discord-bg-tertiary py-1.5 pl-9 pr-3",
              "text-sm text-discord-text-normal placeholder:text-discord-text-muted",
              "outline-none",
            )}
          />
        </div>
      </div>

      {/* Sort toggle */}
      {searchInput && (
        <div className="flex items-center gap-2 border-b border-discord-divider px-3 pb-2">
          <span className="text-xs text-discord-text-muted">並び替え:</span>
          <button
            onClick={() => setSortBy("recent")}
            className={cn(
              "rounded px-2 py-0.5 text-xs",
              sortBy === "recent"
                ? "bg-discord-bg-mod-hover text-discord-text-normal"
                : "text-discord-text-muted hover:text-discord-text-normal",
            )}
          >
            最新
          </button>
          <button
            onClick={() => setSortBy("relevant")}
            className={cn(
              "rounded px-2 py-0.5 text-xs",
              sortBy === "relevant"
                ? "bg-discord-bg-mod-hover text-discord-text-normal"
                : "text-discord-text-muted hover:text-discord-text-normal",
            )}
          >
            関連性
          </button>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && searchInput ? (
          <div className="p-4 text-center text-sm text-discord-text-muted">検索中...</div>
        ) : !searchInput ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Search className="mb-3 h-10 w-10 text-discord-text-muted" />
            <p className="text-sm text-discord-text-muted">検索キーワードを入力してください</p>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState variant="no-results" />
        ) : (
          <div className="space-y-1 p-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-lg p-3",
                  "hover:bg-discord-bg-mod-hover transition-colors cursor-pointer",
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={message.author.avatar ?? undefined}
                    alt={message.author.displayName ?? message.author.username}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-discord-header-primary">
                        {message.author.displayName ?? message.author.username}
                      </span>
                      <span className="text-xs text-discord-text-muted">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-discord-text-normal line-clamp-2">
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div className="px-3 py-2 text-xs text-discord-text-muted">
              {results?.totalResults ?? 0} 件の結果
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
