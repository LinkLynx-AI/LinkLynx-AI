"use client";

import { useState, useCallback } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type AvailabilityStatus = "idle" | "checking" | "available" | "unavailable";

export function VanityURLSettings({
  serverId,
  currentUrl = "",
  onSave,
}: {
  serverId: string;
  currentUrl?: string;
  onSave?: (url: string) => void;
}) {
  const [url, setUrl] = useState(currentUrl);
  const [status, setStatus] = useState<AvailabilityStatus>("idle");

  const handleCheck = useCallback(() => {
    if (!url.trim()) return;
    setStatus("checking");
    setTimeout(() => {
      setStatus("available");
    }, 1000);
  }, [url]);

  const handleSave = () => {
    if (status === "available" && url.trim()) {
      onSave?.(url);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold uppercase text-discord-header-secondary">
        カスタム招待リンク
      </label>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center rounded-md bg-discord-bg-tertiary">
          <span className="shrink-0 pl-3 text-sm text-discord-text-muted">discord.gg/</span>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setStatus("idle");
            }}
            placeholder="your-server"
            className="w-full bg-transparent py-2 pr-3 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none"
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={!url.trim() || status === "checking"}
          className="shrink-0 rounded-md bg-discord-bg-secondary px-3 py-2 text-sm font-medium text-discord-text-normal transition-colors hover:bg-discord-bg-mod-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          確認
        </button>
      </div>

      {/* Status indicator */}
      {status !== "idle" && (
        <div className="flex items-center gap-2 text-sm">
          {status === "checking" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-discord-text-muted" />
              <span className="text-discord-text-muted">確認中...</span>
            </>
          )}
          {status === "available" && (
            <>
              <Check className="h-4 w-4 text-discord-status-online" />
              <span className="text-discord-status-online">利用可能</span>
            </>
          )}
          {status === "unavailable" && (
            <>
              <X className="h-4 w-4 text-discord-status-dnd" />
              <span className="text-discord-status-dnd">利用不可</span>
            </>
          )}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={status !== "available"}
        className="rounded-md bg-discord-brand-blurple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-discord-brand-blurple/80 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  );
}
