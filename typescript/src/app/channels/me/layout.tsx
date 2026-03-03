"use client";

import { useSyncServerId } from "@/hooks/use-sync-guild-params";
import { useDMChannels } from "@/services/queries/use-channels";
import { Avatar } from "@/components/ui/avatar";
import { UserPanel } from "@/components/channel-sidebar/user-panel";
import Link from "next/link";
import { Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export default function DMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // DM mode: no server selected
  useSyncServerId(null);

  const pathname = usePathname();
  const { data: dmChannels } = useDMChannels();
  const isFriendsActive = pathname === "/channels/me";

  return (
    <>
      {/* DM Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col bg-discord-bg-secondary">
        {/* Search bar */}
        <div className="flex h-12 items-center px-2.5 shadow-[0_1px_0_0_rgba(0,0,0,0.2)]">
          <button className="flex-1 h-7 rounded bg-discord-bg-tertiary px-2 text-left text-sm text-discord-text-muted">
            会話を探す
          </button>
        </div>

        {/* DM List */}
        <div className="flex-1 overflow-y-auto discord-scrollbar pt-2">
          {/* Friends button */}
          <Link
            href="/channels/me"
            className={cn(
              "mx-2 mb-1 flex items-center gap-3 rounded px-2.5 py-1.5 cursor-pointer",
              isFriendsActive
                ? "bg-discord-bg-mod-selected text-discord-interactive-active"
                : "text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover"
            )}
          >
            <Users className="h-6 w-6" />
            <span className="text-base font-medium">フレンド</span>
          </Link>

          {/* Section header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <span className="text-category text-discord-channels-default">
              ダイレクトメッセージ
            </span>
            <button className="text-discord-interactive-normal hover:text-discord-interactive-hover">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor">
                <polygon points="15 10 10 10 10 15 8 15 8 10 3 10 3 8 8 8 8 3 10 3 10 8 15 8" />
              </svg>
            </button>
          </div>

          {/* DM items */}
          <div className="flex flex-col">
            {dmChannels?.map((dm) => {
              const recipient = dm.recipients?.[0];
              if (!recipient) return null;
              const isActive = pathname === `/channels/me/${dm.id}`;

              return (
                <Link
                  key={dm.id}
                  href={`/channels/me/${dm.id}`}
                  className={cn(
                    "mx-2 flex items-center gap-3 rounded px-2 py-1.5 cursor-pointer group",
                    isActive
                      ? "bg-discord-bg-mod-selected"
                      : "hover:bg-discord-bg-mod-hover"
                  )}
                >
                  <Avatar
                    src={recipient.avatar ?? undefined}
                    alt={recipient.displayName}
                    size={32}
                    status={recipient.status}
                  />
                  <span
                    className={cn(
                      "flex-1 truncate text-base",
                      isActive
                        ? "text-discord-interactive-active"
                        : "text-discord-channels-default group-hover:text-discord-interactive-hover"
                    )}
                  >
                    {recipient.displayName}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* User panel */}
        <UserPanel />
      </aside>

      {/* Content */}
      <main className="flex flex-1 flex-col min-w-0 bg-discord-bg-primary">
        {children}
      </main>
    </>
  );
}
