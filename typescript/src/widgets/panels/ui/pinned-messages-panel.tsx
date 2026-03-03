"use client";

import { cn } from "@/shared/lib/legacy/cn";
import { useGuildStore } from "@/shared/model/legacy/stores/guild-store";
import { useUIStore } from "@/shared/model/legacy/stores/ui-store";
import { usePinnedMessages } from "@/shared/api/legacy/queries";
import { Avatar, Skeleton } from "@/shared/ui/legacy";
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

export function PinnedMessagesPanel() {
  const channelId = useGuildStore((s) => s.activeChannelId);
  const openModal = useUIStore((s) => s.openModal);
  const { data: pinnedMessages, isLoading } = usePinnedMessages(channelId ?? "");

  const pinCount = pinnedMessages?.length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-lg bg-discord-bg-tertiary p-3">
            <Skeleton width={24} height={24} rounded />
            <div className="flex-1 space-y-2">
              <Skeleton width={120} height={14} />
              <Skeleton width="100%" height={14} />
              <Skeleton width="60%" height={14} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!pinnedMessages?.length) {
    return <EmptyState variant="no-pins" />;
  }

  return (
    <div className="flex flex-col">
      {/* Pin count header */}
      <div className="flex items-center justify-between border-b border-discord-divider px-4 py-2">
        <span className="text-xs font-semibold text-discord-header-secondary">
          {pinCount}/50 ピン留め
        </span>
      </div>

      <div className="space-y-2 p-3">
        {pinnedMessages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "rounded-lg bg-discord-bg-tertiary p-3",
              "hover:bg-discord-bg-mod-hover transition-colors",
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
                <p className="mt-1 text-sm leading-relaxed text-discord-text-normal line-clamp-3">
                  {message.content}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    className={cn("text-xs font-medium text-discord-text-link", "hover:underline")}
                  >
                    ジャンプ
                  </button>
                  <button
                    className={cn(
                      "text-xs font-medium text-discord-text-muted",
                      "hover:text-discord-text-normal hover:underline",
                    )}
                    onClick={() =>
                      openModal("pin-confirm", {
                        messageId: message.id,
                        action: "unpin",
                      })
                    }
                  >
                    ピン留め解除
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
