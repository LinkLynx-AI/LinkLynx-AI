"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { findFirstTextChannel } from "@/features/channel-navigation";
import { useChannels, useChannel } from "@/shared/api/queries/use-channels";
import { buildChannelRoute, buildGuildRoute } from "@/shared/config/routes";
import { useSyncChannelId } from "@/shared/model/hooks/use-sync-guild-params";
import { useVoiceStore } from "@/shared/model/stores/voice-store";
import { ShellStatePlaceholder } from "@/widgets/app-shell";
import { ChatArea } from "./chat-area";
import { VoiceArea } from "@/features/voice";
import { ForumView } from "@/features/forum";
import { StageChannelView } from "@/features/voice";

export function ChannelView({ guildId, channelId }: { guildId: string; channelId: string }) {
  useSyncChannelId(channelId);
  const router = useRouter();
  const { data: channel } = useChannel(channelId);
  const { data: guildChannels, isSuccess: isGuildChannelsSuccess } = useChannels(guildId);
  const voiceConnected = useVoiceStore((s) => s.connected);
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const isCategoryRoute = channel?.type === 4;

  useEffect(() => {
    if (!isCategoryRoute || !isGuildChannelsSuccess) {
      return;
    }

    const nextChannel = findFirstTextChannel(guildChannels ?? []);
    const nextRoute =
      nextChannel === null ? buildGuildRoute(guildId) : buildChannelRoute(guildId, nextChannel.id);
    router.replace(nextRoute);
  }, [guildChannels, guildId, isCategoryRoute, isGuildChannelsSuccess, router]);

  // Forum channel (type 15)
  if (channel?.type === 15) {
    return <ForumView channelId={channelId} channelName={channel.name} />;
  }

  // Stage channel (type 13) - show stage view when connected
  if (channel?.type === 13 && voiceConnected && voiceChannelId === channelId) {
    return <StageChannelView channelId={channelId} channelName={channel.name} />;
  }

  // Voice channel (type 2) - show voice area when connected to this channel
  if (channel?.type === 2 && voiceConnected && voiceChannelId === channelId) {
    return <VoiceArea channelId={channelId} channelName={channel.name} />;
  }

  if (isCategoryRoute) {
    return (
      <div className="p-6">
        <ShellStatePlaceholder
          state="loading"
          title="表示可能なチャンネルへ移動しています"
          description="カテゴリはメッセージを表示できないため、最初のテキストチャンネルへ移動します。"
        />
      </div>
    );
  }

  return (
    <ChatArea
      guildId={guildId}
      channelId={channelId}
      channelName={channel?.name ?? ""}
      topic={channel?.topic ?? undefined}
    />
  );
}
