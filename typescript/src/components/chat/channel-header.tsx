"use client";

import { Hash, Search, Bell, Users, Settings, Pin, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/cn";
import { useUIStore } from "@/stores/ui-store";

export function ChannelHeader({
  channelName,
  topic,
  channelType = "text",
}: {
  channelName: string;
  topic?: string;
  channelType?: "text" | "voice" | "announcement";
}) {
  const toggleMemberList = useUIStore((s) => s.toggleMemberList);
  const memberListVisible = useUIStore((s) => s.memberListVisible);
  const activeRightPanel = useUIStore((s) => s.activeRightPanel);
  const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);

  return (
    <div className="flex h-12 items-center border-b border-discord-header-separator px-4">
      <div className="flex min-w-0 flex-1 items-center">
        <Hash className="mr-1.5 h-5 w-5 shrink-0 text-discord-channels-default" />
        <span className="shrink-0 font-semibold text-discord-header-primary">
          {channelName}
        </span>
        {topic && (
          <>
            <div className="mx-2 h-6 w-px bg-discord-divider" />
            <span className="truncate text-sm text-discord-header-secondary">
              {topic}
            </span>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <button
          onClick={() => setActiveRightPanel("threads")}
          className={cn(
            "transition-colors",
            activeRightPanel === "threads"
              ? "text-discord-interactive-active"
              : "text-discord-interactive-normal hover:text-discord-interactive-hover"
          )}
          aria-label="スレッド"
        >
          <MessageSquareText className="h-5 w-5" />
        </button>
        <button
          onClick={() => setActiveRightPanel("pinned")}
          className={cn(
            "transition-colors",
            activeRightPanel === "pinned"
              ? "text-discord-interactive-active"
              : "text-discord-interactive-normal hover:text-discord-interactive-hover"
          )}
          aria-label="ピン留め"
        >
          <Pin className="h-5 w-5" />
        </button>
        <button
          onClick={() => setActiveRightPanel("search")}
          className={cn(
            "transition-colors",
            activeRightPanel === "search"
              ? "text-discord-interactive-active"
              : "text-discord-interactive-normal hover:text-discord-interactive-hover"
          )}
          aria-label="検索"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          onClick={() => setActiveRightPanel("inbox")}
          className={cn(
            "transition-colors",
            activeRightPanel === "inbox"
              ? "text-discord-interactive-active"
              : "text-discord-interactive-normal hover:text-discord-interactive-hover"
          )}
          aria-label="受信トレイ"
        >
          <Bell className="h-5 w-5" />
        </button>
        <button
          onClick={toggleMemberList}
          className={cn(
            "transition-colors",
            memberListVisible
              ? "text-discord-interactive-active"
              : "text-discord-interactive-normal hover:text-discord-interactive-hover"
          )}
          aria-label="Toggle member list"
        >
          <Users className="h-5 w-5" />
        </button>
        <button
          className={cn(
            "text-discord-interactive-normal hover:text-discord-interactive-hover",
            "transition-colors"
          )}
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
