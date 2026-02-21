"use client";

import { useState, type ReactNode } from "react";
import type { MemberSummary } from "@/entities";
import { AppShellFrame } from "@/widgets/app-shell";
import { ChannelList, type ChannelListItem } from "@/widgets/channel-list";
import { ChatHeader } from "@/widgets/chat-header";
import { MemberPanel } from "@/widgets/member-panel";
import { ServerRail, type ServerRailItem } from "@/widgets/server-rail";

type ChannelsShellProps = {
  children: ReactNode;
};

const serverRailItems: ServerRailItem[] = [
  {
    id: "home",
    label: "Home",
    iconLabel: "LL",
    isSelected: true,
  },
  {
    id: "design",
    label: "Design",
    iconLabel: "DS",
    hasUnread: true,
    mentionCount: 2,
  },
  {
    id: "product",
    label: "Product",
    iconLabel: "PD",
  },
];

const channelListItems: ChannelListItem[] = [
  {
    id: "general",
    label: "general",
    isSelected: true,
  },
  {
    id: "design-review",
    label: "design-review",
    hasUnread: true,
    mentionCount: 1,
  },
  {
    id: "bot-updates",
    label: "bot-updates",
  },
];

const memberPanelItems: MemberSummary[] = [
  {
    id: "member-1",
    displayName: "LinkLynx Bot",
    statusLabel: "Online",
    avatarLabel: "LB",
  },
  {
    id: "member-2",
    displayName: "Design Reviewer",
    statusLabel: "Away",
    avatarLabel: "DR",
  },
];

/**
 * channels配下で利用するアプリシェル骨格を描画する。
 *
 * Contract:
 * - 右サイドパネルの開閉状態は本コンポーネントで管理する
 * - 会話本文は `children` として注入する
 */
export function ChannelsShell({ children }: ChannelsShellProps) {
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(true);

  const rightPanelProps = isMemberPanelOpen
    ? {
        isRightPanelOpen: true as const,
        rightPanelSlot: <MemberPanel members={memberPanelItems} title="Members" />,
      }
    : {
        isRightPanelOpen: false as const,
      };

  return (
    <AppShellFrame
      serverRailSlot={<ServerRail ariaLabel="Servers" items={serverRailItems} />}
      listSlot={<ChannelList ariaLabel="Channel list" items={channelListItems} title="Channels" />}
      mainSlot={
        <section className="flex min-h-0 flex-1 flex-col gap-4" data-testid="channels-shell-main">
          <ChatHeader
            isMemberPanelOpen={isMemberPanelOpen}
            onToggleMemberPanel={() => setIsMemberPanelOpen((current) => !current)}
            subtitle="DM"
            title="Direct Messages"
          />
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-discord-dark/30 p-4">
            {children}
          </div>
        </section>
      }
      {...rightPanelProps}
    />
  );
}
