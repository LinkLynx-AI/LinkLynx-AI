"use client";

import { Volume2, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { useVoiceStore } from "@/stores/voice-store";
import type { Channel } from "@/types/channel";
import type { User } from "@/types/user";

export function VoiceChannel({
  channel,
  serverId,
  connectedUsers = [],
}: {
  channel: Channel;
  serverId: string;
  connectedUsers?: User[];
}) {
  const { connect, connected, channelId } = useVoiceStore();
  const isConnectedHere = connected && channelId === channel.id;

  return (
    <div>
      <button
        onClick={() => connect(serverId, channel.id)}
        className={cn(
          "group mx-2 flex w-[calc(100%-16px)] items-center gap-1.5 rounded px-2 py-1 cursor-pointer",
          "text-[15px] transition-colors",
          "text-discord-channels-default",
          "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
          isConnectedHere && "text-discord-interactive-active"
        )}
      >
        <Volume2 className="h-5 w-5 shrink-0 opacity-70" />
        <span className="truncate">{channel.name}</span>

        <div
          className={cn(
            "ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity",
            "group-hover:opacity-100"
          )}
        >
          <span
            className="rounded p-0.5 text-discord-channels-default hover:text-discord-interactive-hover"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings className="h-4 w-4" />
          </span>
        </div>
      </button>

      {/* Connected users */}
      {connectedUsers.length > 0 && (
        <div className="ml-6 space-y-0.5 pb-1">
          {connectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 text-discord-channels-default"
            >
              <Avatar
                src={user.avatar ?? undefined}
                alt={user.displayName}
                size={16}
                status={user.status}
              />
              <span className="truncate text-sm">{user.displayName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
