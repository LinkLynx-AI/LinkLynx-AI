"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/format-date";
import type { NotificationData } from "./notification-types";

export function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: NotificationData;
  onMarkAsRead: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3 transition-colors",
        "hover:bg-discord-bg-mod-hover",
        !notification.read && "bg-discord-bg-secondary/50"
      )}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-0 top-0 h-full w-1 rounded-r bg-discord-brand-blurple" />
      )}

      {/* Server/DM icon */}
      <Avatar
        src={notification.serverIcon ?? undefined}
        alt={notification.serverName ?? notification.author.displayName}
        size={32}
      />

      <div className="min-w-0 flex-1">
        {/* Channel info */}
        {notification.channelName && (
          <p className="text-xs text-discord-text-muted">
            {notification.serverName && (
              <span className="font-medium">{notification.serverName}</span>
            )}
            {notification.serverName && " > "}
            #{notification.channelName}
          </p>
        )}
        {!notification.channelName && notification.serverName && (
          <p className="text-xs text-discord-text-muted">
            {notification.serverName}
          </p>
        )}
        {!notification.channelName && !notification.serverName && (
          <p className="text-xs text-discord-text-muted">ダイレクトメッセージ</p>
        )}

        {/* Message */}
        <p className="mt-0.5 text-sm text-discord-text-normal truncate">
          <span className="font-medium">{notification.author.displayName}</span>
          {": "}
          {notification.content}
        </p>

        {/* Timestamp */}
        <p className="mt-0.5 text-xs text-discord-text-muted">
          {formatRelativeTime(notification.timestamp)}
        </p>
      </div>

      {/* Mark as read button */}
      {!notification.read && (
        <button
          onClick={() => onMarkAsRead(notification.id)}
          className={cn(
            "shrink-0 rounded p-1 text-discord-interactive-normal opacity-0 transition-all",
            "hover:text-discord-interactive-hover group-hover:opacity-100"
          )}
          aria-label="既読にする"
        >
          <Check className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
