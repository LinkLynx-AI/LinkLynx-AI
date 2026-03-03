"use client";

import { use } from "react";
import { ChatArea } from "@/components/chat/chat-area";
import { useChannel } from "@/services/queries/use-channels";

export default function DMConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const { data: channel } = useChannel(conversationId);

  const recipient = channel?.recipients?.[0];
  const displayName = recipient?.displayName ?? "DM";

  return <ChatArea channelId={conversationId} channelName={displayName} />;
}
