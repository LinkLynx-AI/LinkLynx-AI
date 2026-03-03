"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { Search, X } from "lucide-react";
import { Avatar } from "@/shared/ui/legacy/avatar";

type SearchResult = {
  messageId: string;
  content: string;
  authorName: string;
  authorAvatar: string | null;
  timestamp: string;
};

const mockSearchResults: SearchResult[] = [];

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-500/30 text-discord-text-normal rounded-sm">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function ThreadSearch({ threadId, onClose }: { threadId: string; onClose: () => void }) {
  const [query, setQuery] = useState("");

  const results = query.trim()
    ? mockSearchResults.filter((r) => r.content.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="border-b border-discord-divider bg-discord-bg-secondary">
      {/* Search input */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Search className="h-4 w-4 shrink-0 text-discord-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="スレッド内を検索"
          className="flex-1 bg-transparent text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none"
          autoFocus
        />
        <button
          onClick={onClose}
          className="text-discord-interactive-normal hover:text-discord-interactive-hover transition-colors"
          aria-label="検索を閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Results */}
      {query.trim() && (
        <div className="max-h-[200px] overflow-y-auto px-2 pb-2">
          {results.length > 0 ? (
            results.map((result) => (
              <button
                key={result.messageId}
                className={cn(
                  "flex w-full items-start gap-2 rounded px-3 py-2 text-left",
                  "hover:bg-discord-bg-mod-hover transition-colors",
                )}
              >
                <Avatar src={result.authorAvatar ?? undefined} alt={result.authorName} size={16} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-discord-header-primary">
                      {result.authorName}
                    </span>
                    <span className="text-xs text-discord-text-muted">{result.timestamp}</span>
                  </div>
                  <p className="text-sm text-discord-text-normal">
                    {highlightText(result.content, query)}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="py-3 text-center text-sm text-discord-text-muted">
              結果が見つかりません
            </div>
          )}
        </div>
      )}
    </div>
  );
}
