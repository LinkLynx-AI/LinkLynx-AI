"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useChannels } from "@/shared/api/queries/use-channels";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { buildModerationQueueRoute, parseGuildChannelRoute } from "@/shared/config/routes";
import { useGuildStore } from "@/shared/model/stores/guild-store";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { useServer } from "@/shared/api/queries/use-servers";
import { usePathname } from "next/navigation";
import { ServerHeader } from "./server-header";
import { ChannelCategory } from "./channel-category";
import { ChannelItem } from "./channel-item";
import { VoiceChannel } from "./voice-channel";
import { UserPanel } from "./user-panel";
import { VoiceConnectionPanel } from "./voice-connection-panel";
import type { Channel } from "@/shared/model/types/channel";

type CategoryGroup = {
  category: Channel | null;
  channels: Channel[];
};

function compareChannelPosition(a: Channel, b: Channel): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

export function groupChannelsByCategory(channels: Channel[]): CategoryGroup[] {
  return channels
    .filter((channel) => channel.type === 4 || !channel.parentId)
    .sort(compareChannelPosition)
    .map((channel) => {
      if (channel.type !== 4) {
        return { category: null, channels: [channel] };
      }

      const children = channels
        .filter((child) => child.parentId === channel.id && child.type !== 4)
        .sort(compareChannelPosition);
      return { category: channel, channels: children };
    });
}

export function ChannelSidebar() {
  const pathname = usePathname();
  const routeSelection = parseGuildChannelRoute(pathname ?? "");
  const activeServerIdFromStore = useGuildStore((s) => s.activeServerId);
  const activeChannelIdFromStore = useGuildStore((s) => s.activeChannelId);
  const activeServerId = routeSelection?.guildId ?? activeServerIdFromStore;
  const activeChannelId = routeSelection ? routeSelection.channelId : activeChannelIdFromStore;
  const collapsedCategories = useGuildStore((s) => s.collapsedCategories);
  const toggleCategory = useGuildStore((s) => s.toggleCategory);
  const openModal = useUIStore((s) => s.openModal);

  const { data: server } = useServer(activeServerId ?? "");
  const {
    data: channels,
    isLoading: isChannelsLoading,
    isError: isChannelsError,
    error: channelsError,
  } = useChannels(activeServerId ?? "");

  const groups = useMemo(
    () => (channels === undefined ? [] : groupChannelsByCategory(channels)),
    [channels],
  );
  const channelErrorMessage = toApiErrorText(channelsError, "チャンネル一覧の取得に失敗しました。");
  const shouldShowChannelError = isChannelsError && (channels?.length ?? 0) === 0;

  if (!activeServerId) return null;

  const collapsed = collapsedCategories[activeServerId] ?? new Set<string>();

  return (
    <div className="flex h-full w-60 flex-col bg-discord-bg-secondary">
      <ServerHeader serverName={server?.name ?? "サーバー"} />

      {/* Channel list */}
      <div className="discord-scrollbar flex-1 overflow-y-auto pb-2">
        {isChannelsLoading && (
          <div className="px-4 py-3 text-sm text-discord-text-muted">チャンネルを読み込み中...</div>
        )}

        {shouldShowChannelError && (
          <div className="px-4 py-3 text-xs leading-5 text-discord-text-muted">
            {channelErrorMessage}
          </div>
        )}

        {!isChannelsLoading && !shouldShowChannelError && groups.length === 0 && (
          <div className="px-4 py-3 text-sm text-discord-text-muted">
            表示可能なチャンネルがありません。
          </div>
        )}

        {!isChannelsLoading &&
          !shouldShowChannelError &&
          groups.map((group) => {
            const key = group.category?.id ?? "__top__";
            const isCollapsed = group.category ? collapsed.has(group.category.id) : false;

            if (!group.category) {
              // Top-level channels without category
              return (
                <div key={key} className="pt-2">
                  {group.channels.map((ch) =>
                    ch.type === 2 ? (
                      <VoiceChannel key={ch.id} channel={ch} serverId={activeServerId} />
                    ) : (
                      <ChannelItem
                        key={ch.id}
                        channel={ch}
                        serverId={activeServerId}
                        isActive={activeChannelId === ch.id}
                        isUnread={false}
                        isMuted={false}
                      />
                    ),
                  )}
                </div>
              );
            }

            return (
              <ChannelCategory
                key={key}
                channel={group.category}
                serverId={activeServerId}
                name={group.category.name}
                collapsed={isCollapsed}
                onToggle={() => toggleCategory(activeServerId, group.category!.id)}
                onCreateChannel={() =>
                  openModal("create-channel", {
                    serverId: activeServerId,
                    parentId: group.category!.id,
                  })
                }
              >
                {group.channels.map((ch) =>
                  ch.type === 2 ? (
                    <VoiceChannel key={ch.id} channel={ch} serverId={activeServerId} />
                  ) : (
                    <ChannelItem
                      key={ch.id}
                      channel={ch}
                      serverId={activeServerId}
                      isActive={activeChannelId === ch.id}
                      isUnread={false}
                      isMuted={false}
                    />
                  ),
                )}
              </ChannelCategory>
            );
          })}

        <div className="mt-2 px-2">
          <Link
            href={buildModerationQueueRoute(activeServerId)}
            className="mx-1 flex items-center gap-2 rounded px-2 py-1 text-sm text-discord-channels-default transition-colors hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover"
          >
            <span className="text-xs font-semibold uppercase tracking-wide">MOD</span>
            <span>モデレーションキュー</span>
          </Link>
        </div>
      </div>

      {/* Voice connection panel (shows when connected) */}
      <VoiceConnectionPanel />

      {/* User panel */}
      <UserPanel />
    </div>
  );
}
