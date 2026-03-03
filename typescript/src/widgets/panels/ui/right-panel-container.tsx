"use client";

import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { PinnedMessagesPanel } from "./pinned-messages-panel";
import { SearchPanel } from "./search-panel";
import { ThreadsPanel } from "./threads-panel";
import { NotificationInbox } from "@/widgets/notifications";

const PANEL_TITLES: Record<string, string> = {
  pinned: "ピン留めされたメッセージ",
  search: "検索結果",
  threads: "スレッド",
  inbox: "受信トレイ",
};

export function RightPanelContainer() {
  const activeRightPanel = useUIStore((s) => s.activeRightPanel);
  const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);

  if (!activeRightPanel || activeRightPanel === "members") {
    return null;
  }

  const title = PANEL_TITLES[activeRightPanel] ?? "";

  return (
    <div
      className={cn(
        "flex h-full w-[420px] shrink-0 flex-col",
        "border-l border-discord-divider bg-discord-bg-secondary",
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-discord-header-separator px-4">
        <h2 className="font-semibold text-discord-header-primary">{title}</h2>
        <button
          onClick={() => setActiveRightPanel(null)}
          className={cn(
            "rounded p-1 text-discord-interactive-normal",
            "hover:text-discord-interactive-hover transition-colors",
          )}
          aria-label="パネルを閉じる"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {activeRightPanel === "pinned" && <PinnedMessagesPanel />}
        {activeRightPanel === "search" && <SearchPanel />}
        {activeRightPanel === "threads" && <ThreadsPanel />}
        {activeRightPanel === "inbox" && <NotificationInbox />}
      </div>
    </div>
  );
}
