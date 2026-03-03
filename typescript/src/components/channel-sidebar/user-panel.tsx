"use client";

import { Mic, MicOff, Headphones, HeadphoneOff, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth-store";
import { useVoiceStore } from "@/stores/voice-store";

export function UserPanel() {
  const { currentUser, status, customStatus } = useAuthStore();
  const { selfMuted, selfDeafened, toggleMute, toggleDeafen } =
    useVoiceStore();

  if (!currentUser) return null;

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 bg-discord-bg-floating/50 px-2">
      {/* Avatar + info */}
      <button className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 hover:bg-discord-bg-mod-hover">
        <Avatar
          src={currentUser.avatar ?? undefined}
          alt={currentUser.displayName}
          size={32}
          status={status}
        />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-discord-header-primary">
            {currentUser.displayName}
          </span>
          <span className="truncate text-xs text-discord-header-secondary">
            {customStatus || currentUser.username}
          </span>
        </div>
      </button>

      {/* Control buttons */}
      <div className="flex shrink-0 items-center">
        <Tooltip content={selfMuted ? "ミュート解除" : "ミュート"} position="top">
          <button
            onClick={toggleMute}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded hover:bg-discord-bg-mod-hover",
              selfMuted
                ? "text-discord-brand-red"
                : "text-discord-interactive-normal hover:text-discord-interactive-hover"
            )}
          >
            {selfMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        </Tooltip>

        <Tooltip
          content={selfDeafened ? "スピーカーミュート解除" : "スピーカーミュート"}
          position="top"
        >
          <button
            onClick={toggleDeafen}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded hover:bg-discord-bg-mod-hover",
              selfDeafened
                ? "text-discord-brand-red"
                : "text-discord-interactive-normal hover:text-discord-interactive-hover"
            )}
          >
            {selfDeafened ? (
              <HeadphoneOff className="h-5 w-5" />
            ) : (
              <Headphones className="h-5 w-5" />
            )}
          </button>
        </Tooltip>

        <Tooltip content="ユーザー設定" position="top">
          <button className="flex h-8 w-8 items-center justify-center rounded text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover">
            <Settings className="h-5 w-5" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
