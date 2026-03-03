"use client";

import { PhoneOff, Signal } from "lucide-react";
import { cn } from "@/lib/cn";
import { useVoiceStore } from "@/stores/voice-store";
import { useChannel } from "@/services/queries/use-channels";

export function VoiceConnectionPanel() {
  const { connected, channelId, disconnect } = useVoiceStore();

  const { data: channel } = useChannel(channelId ?? "");

  if (!connected || !channelId) return null;

  return (
    <div className="shrink-0 border-t border-discord-divider bg-discord-bg-secondary px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <Signal className="h-4 w-4 shrink-0 text-discord-btn-success" />
            <span className="text-sm font-medium text-discord-btn-success">音声接続中</span>
          </div>
          <span className="block truncate text-xs text-discord-channels-default">
            {channel?.name ?? "..."}
          </span>
        </div>
        <button
          onClick={disconnect}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded",
            "text-discord-channels-default hover:bg-discord-brand-red/20 hover:text-discord-brand-red",
          )}
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
