"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Hash, Megaphone, Settings, UserPlus } from "lucide-react";
import { useActionGuard } from "@/shared/api/queries";
import { cn } from "@/shared/lib/cn";
import { useUIStore } from "@/shared/model/stores/ui-store";
import type { Channel } from "@/shared/model/types/channel";

function ChannelIcon({ type }: { type: number }) {
  if (type === 5) {
    return <Megaphone className="h-5 w-5 shrink-0 opacity-70" />;
  }
  return <Hash className="h-5 w-5 shrink-0 opacity-70" />;
}

export function ChannelItem({
  channel,
  serverId,
  isActive,
  isUnread,
  isMuted,
}: {
  channel: Channel;
  serverId: string;
  isActive: boolean;
  isUnread: boolean;
  isMuted: boolean;
}) {
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const openModal = useUIStore((s) => s.openModal);
  const [didPrimeGuards, setDidPrimeGuards] = useState(isActive);
  const manageChannelGuard = useActionGuard({
    serverId,
    channelId: channel.id,
    requirement: "channel:manage",
    enabled: didPrimeGuards,
  });
  const createInviteGuard = useActionGuard({
    serverId,
    requirement: "guild:create-invite",
    enabled: didPrimeGuards,
  });

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      showContextMenu("channel", { x: e.clientX, y: e.clientY }, { channel, serverId });
    },
    [channel, serverId, showContextMenu],
  );
  const openChannelEditModal = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      openModal("channel-edit", {
        channelId: channel.id,
        channelName: channel.name,
        channelType: channel.type,
        serverId,
      });
    },
    [channel.id, channel.name, channel.type, openModal, serverId],
  );
  const openCreateInviteModal = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      openModal("create-invite", {
        serverId,
        channelId: channel.id,
      });
    },
    [channel.id, openModal, serverId],
  );
  const primeManageGuard = () => {
    if (!didPrimeGuards) {
      setDidPrimeGuards(true);
    }
  };

  return (
    <Link
      onContextMenu={handleContextMenu}
      onMouseEnter={primeManageGuard}
      onFocusCapture={primeManageGuard}
      href={`/channels/${serverId}/${channel.id}`}
      className={cn(
        "group mx-2 flex items-center gap-1.5 rounded px-2 py-1 cursor-pointer",
        "text-[15px] transition-colors",
        // Default
        "text-discord-channels-default",
        // Hover
        "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
        // Active
        isActive && "bg-discord-bg-mod-selected text-discord-interactive-active font-medium",
        // Unread (stronger text, bold) - only if not active
        !isActive && isUnread && "text-discord-text-normal font-medium",
        // Muted
        !isActive && !isUnread && isMuted && "text-discord-interactive-muted",
      )}
    >
      <ChannelIcon type={channel.type} />
      <span className="truncate">{channel.name}</span>

      {/* Hover action icons */}
      <div
        className={cn(
          "ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity",
          "group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          aria-label="招待を作成"
          className="rounded p-0.5 text-discord-channels-default hover:text-discord-interactive-hover"
          disabled={!createInviteGuard.isAllowed}
          onClick={openCreateInviteModal}
        >
          <UserPlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="チャンネルを編集"
          className="rounded p-0.5 text-discord-channels-default hover:text-discord-interactive-hover"
          disabled={!manageChannelGuard.isAllowed}
          onClick={openChannelEditModal}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </Link>
  );
}
