"use client";

import { Avatar } from "@/shared/ui/avatar";
import { MessageSquare, Phone } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { User } from "@/shared/model/types";

const statusText: Record<string, string> = {
  online: "オンライン",
  idle: "退席中",
  dnd: "取り込み中",
  offline: "オフライン",
};

export function FriendItem({ user, actions }: { user: User; actions?: React.ReactNode }) {
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-discord-bg-mod-hover cursor-pointer border-t border-discord-bg-mod-faint">
      <Avatar
        src={user.avatar ?? undefined}
        alt={user.displayName}
        size={32}
        status={user.status}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-discord-text-normal truncate">{user.displayName}</p>
        <p className="text-xs text-discord-text-muted truncate">
          {user.customStatus ?? statusText[user.status] ?? "オフライン"}
        </p>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {actions ?? (
          <>
            <button
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                "bg-discord-bg-secondary text-discord-interactive-normal",
                "hover:text-discord-interactive-hover",
              )}
              aria-label="メッセージ"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <button
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                "bg-discord-bg-secondary text-discord-interactive-normal",
                "hover:text-discord-interactive-hover",
              )}
              aria-label="通話"
            >
              <Phone className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
