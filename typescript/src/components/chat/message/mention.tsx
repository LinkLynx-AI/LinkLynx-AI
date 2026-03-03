"use client";

import { cn } from "@/lib/cn";

export function UserMention({ userId, displayName }: { userId: string; displayName?: string }) {
  return (
    <span
      className={cn(
        "cursor-pointer rounded-[3px] px-0.5",
        "bg-discord-mention-bg text-discord-text-link font-medium",
        "hover:bg-discord-mention-hover-bg hover:text-white",
      )}
      role="button"
      tabIndex={0}
    >
      @{displayName ?? "Unknown User"}
    </span>
  );
}

export function EveryoneMention() {
  return (
    <span
      className={cn(
        "rounded-[3px] px-0.5",
        "bg-discord-mention-bg text-discord-text-link font-medium",
      )}
    >
      @everyone
    </span>
  );
}

export function HereMention() {
  return (
    <span
      className={cn(
        "rounded-[3px] px-0.5",
        "bg-discord-mention-bg text-discord-text-link font-medium",
      )}
    >
      @here
    </span>
  );
}

export function ChannelMention({
  channelId,
  channelName,
}: {
  channelId: string;
  channelName?: string;
}) {
  return (
    <span
      className={cn(
        "cursor-pointer rounded-[3px] px-0.5",
        "bg-discord-mention-bg text-discord-text-link font-medium",
        "hover:bg-discord-mention-hover-bg hover:text-white",
      )}
      role="button"
      tabIndex={0}
    >
      #{channelName ?? "unknown-channel"}
    </span>
  );
}
