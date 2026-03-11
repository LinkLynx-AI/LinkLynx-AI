"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useUIStore } from "@/shared/model/stores/ui-store";
import type { Channel } from "@/shared/model/types/channel";

export function ChannelCategory({
  channel,
  serverId,
  name,
  collapsed,
  onToggle,
  onCreateChannel,
  children,
}: {
  channel: Channel;
  serverId: string;
  name: string;
  collapsed: boolean;
  onToggle: () => void;
  onCreateChannel: () => void;
  children: React.ReactNode;
}) {
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  return (
    <div className="mt-4">
      <div className="group flex items-center gap-1 px-0.5 pb-1">
        <button
          onClick={onToggle}
          onContextMenu={(event) => {
            event.preventDefault();
            showContextMenu(
              "channel",
              { x: event.clientX, y: event.clientY },
              { channel, serverId },
            );
          }}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-0.5",
            "text-category text-discord-channels-default",
            "hover:text-discord-interactive-hover",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{name}</span>
        </button>
        <button
          type="button"
          aria-label="配下にチャンネルを作成"
          className="rounded p-0.5 text-discord-channels-default opacity-0 transition-opacity hover:text-discord-interactive-hover group-hover:opacity-100"
          onClick={onCreateChannel}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}
