"use client";

import { cn } from "@/shared/lib/legacy/cn";
import { Archive, Lock } from "lucide-react";

export function ThreadArchiveBanner({
  isArchived,
  isLocked,
  onUnarchive,
}: {
  isArchived: boolean;
  isLocked: boolean;
  onUnarchive?: () => void;
}) {
  if (!isArchived && !isLocked) return null;

  const getMessage = () => {
    if (isArchived && isLocked) {
      return "このスレッドはアーカイブされ、ロックされています";
    }
    if (isLocked) {
      return "このスレッドはロックされています";
    }
    return "このスレッドはアーカイブされています";
  };

  return (
    <div
      className={cn(
        "mx-4 mb-2 flex items-center justify-between rounded-lg px-4 py-2.5",
        isLocked ? "bg-discord-bg-secondary" : "bg-yellow-500/10 text-yellow-400",
      )}
      data-testid="thread-archive-banner"
    >
      <div className="flex items-center gap-2">
        {isLocked ? (
          <Lock className={cn("h-4 w-4", !isArchived && "text-discord-text-muted")} />
        ) : (
          <Archive className="h-4 w-4" />
        )}
        <span
          className={cn(
            "text-sm",
            isLocked && !isArchived
              ? "text-discord-text-muted"
              : isLocked
                ? "text-discord-text-muted"
                : "",
          )}
        >
          {getMessage()}
        </span>
      </div>
      {isArchived && !isLocked && onUnarchive && (
        <button
          onClick={onUnarchive}
          className="rounded bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-400 hover:bg-yellow-500/30 transition-colors"
        >
          アーカイブ解除
        </button>
      )}
    </div>
  );
}
