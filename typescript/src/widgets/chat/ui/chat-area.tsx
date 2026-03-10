"use client";

import { useState } from "react";
import { toMessageTimelineErrorText } from "@/shared/api";
import { useMessages } from "@/shared/api/queries";
import { ChannelHeader } from "./channel-header";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { FileDropZone } from "./message-input/file-drop-zone";

export function ChatArea({
  guildId,
  channelId,
  channelName,
  topic,
}: {
  guildId?: string;
  channelId: string;
  channelName: string;
  topic?: string;
}) {
  const messagesQuery = useMessages(guildId, channelId);
  const [scrollToBottomToken, setScrollToBottomToken] = useState(0);
  const timelineErrorMessage =
    messagesQuery.isError && messagesQuery.messages.length === 0
      ? toMessageTimelineErrorText(messagesQuery.error, "メッセージの取得に失敗しました。")
      : null;
  const loadMoreErrorMessage = messagesQuery.isFetchNextPageError
    ? toMessageTimelineErrorText(messagesQuery.error, "過去のメッセージの取得に失敗しました。")
    : null;

  return (
    <div className="flex flex-1 flex-col bg-discord-bg-primary">
      <ChannelHeader channelName={channelName} topic={topic} />
      <FileDropZone channelId={channelId} disabled={guildId === undefined}>
        <MessageList
          messages={messagesQuery.messages}
          channelName={channelName}
          isLoading={messagesQuery.isLoading}
          errorMessage={timelineErrorMessage}
          hasMore={messagesQuery.hasMore}
          isLoadingMore={messagesQuery.isFetchingNextPage}
          loadMoreErrorMessage={loadMoreErrorMessage}
          onLoadMore={messagesQuery.loadOlder}
          scrollToBottomToken={scrollToBottomToken}
        />
        <MessageInput
          guildId={guildId}
          channelId={channelId}
          channelName={channelName}
          onMessageSent={() => setScrollToBottomToken((current) => current + 1)}
        />
      </FileDropZone>
    </div>
  );
}
