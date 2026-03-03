"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format-date";
import type { ThreadData } from "./thread-types";

export function ThreadCard({
  thread,
  onSelect,
}: {
  thread: ThreadData;
  onSelect: (thread: ThreadData) => void;
}) {
  return (
    <button
      onClick={() => onSelect(thread)}
      className={cn(
        "w-full rounded-lg p-3 text-left",
        "hover:bg-discord-bg-mod-hover transition-colors cursor-pointer"
      )}
    >
      <div className="font-semibold text-sm text-discord-header-primary">
        {thread.name}
      </div>
      <p className="mt-1 truncate text-sm text-discord-text-muted">
        {thread.lastMessageAuthor}: {thread.lastMessagePreview}
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs text-discord-text-muted">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {thread.messageCount}
        </span>
        <span>{formatRelativeTime(thread.lastActivityAt)}</span>
      </div>
    </button>
  );
}
