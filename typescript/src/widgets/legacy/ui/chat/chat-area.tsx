"use client";

import { useMessages } from "@/shared/api/legacy/queries/use-messages";
import { ChannelHeader } from "./channel-header";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { FileDropZone } from "./message-input/file-drop-zone";

export function ChatArea({
  channelId,
  channelName,
  topic,
}: {
  channelId: string;
  channelName: string;
  topic?: string;
}) {
  const { data: messages = [] } = useMessages(channelId);

  return (
    <div className="flex flex-1 flex-col bg-discord-bg-primary">
      <ChannelHeader channelName={channelName} topic={topic} />
      <FileDropZone channelId={channelId}>
        <MessageList messages={messages} channelName={channelName} />
        <MessageInput channelId={channelId} channelName={channelName} />
      </FileDropZone>
    </div>
  );
}
