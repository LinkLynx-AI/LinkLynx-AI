"use client";

import { useSyncChannelId } from "@/shared/model/legacy/hooks/use-sync-guild-params";
import { useChannel } from "@/shared/api/legacy/queries/use-channels";
import { useVoiceStore } from "@/shared/model/legacy/stores/voice-store";
import { ChatArea } from "./chat-area";
import { VoiceArea } from "@/widgets/legacy/ui/voice";
import { ForumView } from "@/widgets/legacy/ui/forum";
import { StageChannelView } from "@/widgets/legacy/ui/voice";

export function ChannelView({ channelId }: { channelId: string }) {
  useSyncChannelId(channelId);
  const { data: channel } = useChannel(channelId);
  const voiceConnected = useVoiceStore((s) => s.connected);
  const voiceChannelId = useVoiceStore((s) => s.channelId);

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

  return (
    <ChatArea
      channelId={channelId}
      channelName={channel?.name ?? ""}
      topic={channel?.topic ?? undefined}
    />
  );
}
