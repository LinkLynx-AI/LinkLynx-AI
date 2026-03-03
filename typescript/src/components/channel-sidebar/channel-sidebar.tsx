"use client";

import { useMemo } from "react";
import { useChannels } from "@/services/queries/use-channels";
import { useGuildStore } from "@/stores/guild-store";
import { useServer } from "@/services/queries/use-servers";
import { ServerHeader } from "./server-header";
import { ChannelCategory } from "./channel-category";
import { ChannelItem } from "./channel-item";
import { VoiceChannel } from "./voice-channel";
import { UserPanel } from "./user-panel";
import { VoiceConnectionPanel } from "./voice-connection-panel";
import type { Channel } from "@/types/channel";

interface CategoryGroup {
  category: Channel | null;
  channels: Channel[];
}

function groupChannelsByCategory(channels: Channel[]): CategoryGroup[] {
  const categories = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);

  const groups: CategoryGroup[] = [];

  // Channels without a parent category (top-level)
  const orphans = channels
    .filter((c) => c.type !== 4 && !c.parentId)
    .sort((a, b) => a.position - b.position);

  if (orphans.length > 0) {
    groups.push({ category: null, channels: orphans });
  }

  for (const cat of categories) {
    const children = channels
      .filter((c) => c.parentId === cat.id && c.type !== 4)
      .sort((a, b) => a.position - b.position);
    groups.push({ category: cat, channels: children });
  }

  return groups;
}

export function ChannelSidebar() {
  const activeServerId = useGuildStore((s) => s.activeServerId);
  const activeChannelId = useGuildStore((s) => s.activeChannelId);
  const collapsedCategories = useGuildStore((s) => s.collapsedCategories);
  const toggleCategory = useGuildStore((s) => s.toggleCategory);

  const { data: server } = useServer(activeServerId ?? "");
  const { data: channels } = useChannels(activeServerId ?? "");

  const groups = useMemo(() => groupChannelsByCategory(channels ?? []), [channels]);

  if (!activeServerId) return null;

  const collapsed = collapsedCategories[activeServerId] ?? new Set<string>();

  return (
    <div className="flex h-full w-60 flex-col bg-discord-bg-secondary">
      <ServerHeader serverName={server?.name ?? ""} />

      {/* Channel list */}
      <div className="discord-scrollbar flex-1 overflow-y-auto pb-2">
        {groups.map((group) => {
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
              name={group.category.name}
              collapsed={isCollapsed}
              onToggle={() => toggleCategory(activeServerId, group.category!.id)}
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
      </div>

      {/* Voice connection panel (shows when connected) */}
      <VoiceConnectionPanel />

      {/* User panel */}
      <UserPanel />
    </div>
  );
}
