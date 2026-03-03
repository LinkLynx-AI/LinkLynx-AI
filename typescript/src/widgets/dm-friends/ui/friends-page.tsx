"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { FriendList } from "./friend-list";
import { PendingRequests } from "./pending-requests";
import { AddFriend } from "./add-friend";

const tabs = ["オンライン", "全て", "保留中", "ブロック中"] as const;

export function FriendsPage() {
  const [activeTab, setActiveTab] = useState<string>("オンライン");

  return (
    <>
      {/* Header */}
      <header className="flex h-12 items-center gap-4 border-b border-discord-header-separator px-4 shrink-0">
        <div className="flex items-center gap-2 text-discord-header-primary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            <path d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.25.56 1.25 1.25V5H7a.75.75 0 0 1 0 1.5H5.5v1.25c0 .69-.56 1.25-1.25 1.25S3 8.44 3 7.75V6.5H1.75a.75.75 0 0 1 0-1.5H3Z" />
            <path d="M13 12c-3.73 0-9 1.87-9 5.5V20h18v-2.5c0-3.63-5.27-5.5-9-5.5Z" />
          </svg>
          <span className="font-semibold">フレンド</span>
        </div>
        <div className="h-6 w-px bg-discord-divider" />
        <nav className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded px-2 py-0.5 text-sm font-medium",
                activeTab === tab
                  ? "bg-discord-bg-mod-selected text-discord-interactive-active"
                  : "text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
              )}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => setActiveTab("フレンドに追加")}
            className={cn(
              "rounded px-2 py-0.5 text-sm font-medium",
              activeTab === "フレンドに追加"
                ? "bg-transparent text-discord-brand-green"
                : "bg-discord-brand-green text-white",
            )}
          >
            フレンドに追加
          </button>
        </nav>
      </header>

      {/* Content */}
      {activeTab === "フレンドに追加" ? (
        <AddFriend />
      ) : activeTab === "保留中" ? (
        <PendingRequests />
      ) : (
        <FriendList activeTab={activeTab} />
      )}
    </>
  );
}
