"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search } from "lucide-react";
import { useServers } from "@/shared/api/queries/use-servers";
import { useDMChannels } from "@/shared/api/queries/use-channels";
import { cn } from "@/shared/lib/cn";
import { useRouter } from "next/navigation";

type SearchResultItem = {
  id: string;
  type: "server" | "channel" | "dm";
  name: string;
  extra?: string;
  icon?: string | null;
  href: string;
};

export function QuickSwitcherModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { data: servers } = useServers();
  const { data: dmChannels } = useDMChannels();

  const results: SearchResultItem[] = (() => {
    const items: SearchResultItem[] = [];
    const q = query.toLowerCase();

    if (servers) {
      for (const server of servers) {
        if (!q || server.name.toLowerCase().includes(q)) {
          items.push({
            id: server.id,
            type: "server",
            name: server.name,
            icon: server.icon,
            href: `/channels/${server.id}`,
          });
        }
      }
    }

    if (dmChannels) {
      for (const dm of dmChannels) {
        const name = dm.recipients?.[0]?.displayName ?? dm.name;
        if (!q || name.toLowerCase().includes(q)) {
          items.push({
            id: dm.id,
            type: "dm",
            name,
            icon: dm.recipients?.[0]?.avatar ?? null,
            href: `/channels/@me/${dm.id}`,
          });
        }
      }
    }

    return items;
  })();

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      router.push(item.href);
      onClose();
    },
    [router, onClose],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, results, selectedIndex, handleSelect]);

  const typeLabels: Record<SearchResultItem["type"], string> = {
    server: "サーバー",
    channel: "チャンネル",
    dm: "ダイレクトメッセージ",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[580px] rounded-lg bg-discord-bg-primary shadow-xl">
        <div className="flex items-center gap-3 border-b border-discord-border-subtle px-4">
          <Search className="h-5 w-5 text-discord-interactive-normal" />
          <input
            ref={inputRef}
            type="text"
            placeholder="移動先を検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 flex-1 bg-transparent text-discord-text-normal placeholder:text-discord-text-muted outline-none"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="py-8 text-center text-sm text-discord-text-muted">
              結果が見つかりませんでした
            </div>
          ) : (
            <>
              {(["server", "dm", "channel"] as const).map((type) => {
                const grouped = results.filter((r) => r.type === type);
                if (grouped.length === 0) return null;
                return (
                  <div key={type}>
                    <p className="px-2 py-1.5 text-xs font-bold uppercase text-discord-header-secondary">
                      {typeLabels[type]}
                    </p>
                    {grouped.map((item) => {
                      const globalIndex = results.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-sm transition-colors",
                            globalIndex === selectedIndex
                              ? "bg-discord-bg-mod-selected text-white"
                              : "text-discord-text-normal hover:bg-discord-bg-mod-hover",
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-discord-bg-tertiary text-xs font-bold text-discord-text-normal">
                            {item.icon ? (
                              <img
                                src={item.icon}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              item.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 truncate">
                            <span>{item.name}</span>
                            {item.extra && (
                              <span className="ml-2 text-xs text-discord-text-muted">
                                {item.extra}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="border-t border-discord-border-subtle px-4 py-2 text-xs text-discord-text-muted">
          <span className="font-mono">ESC</span> で閉じる ・ <span className="font-mono">↑↓</span>{" "}
          で移動 ・ <span className="font-mono">Enter</span> で選択
        </div>
      </div>
    </div>
  );
}
