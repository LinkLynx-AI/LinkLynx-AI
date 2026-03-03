"use client";

import { useCallback } from "react";
import { Avatar } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/cn";
import { useUIStore } from "@/shared/model/stores/ui-store";
import type { GuildMember } from "@/shared/model/types/server";

export function MemberItem({ member, roleColor }: { member: GuildMember; roleColor?: string }) {
  const showProfilePopout = useUIStore((s) => s.showProfilePopout);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const { user } = member;
  const displayName = member.nick ?? user.displayName;
  const isOffline = user.status === "offline";

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    showProfilePopout(user.id, { x: rect.left - 310, y: rect.top });
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      showContextMenu("user", { x: e.clientX, y: e.clientY }, { user });
    },
    [user, showContextMenu],
  );

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "flex w-full items-center gap-3 rounded px-2 py-1 text-left",
        "hover:bg-discord-bg-mod-hover",
        isOffline && "opacity-30",
      )}
    >
      <Avatar
        src={member.avatar ?? user.avatar ?? undefined}
        alt={displayName}
        size={32}
        status={user.status}
      />
      <div className="min-w-0 flex-1">
        <span
          className="block truncate text-sm font-medium"
          style={roleColor ? { color: roleColor } : undefined}
        >
          {displayName}
        </span>
        {user.customStatus && (
          <span className="block truncate text-xs text-discord-text-muted">
            {user.customStatus}
          </span>
        )}
      </div>
    </button>
  );
}
