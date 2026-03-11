"use client";

import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import type { Message } from "@/shared/model/types";
import { appendMessageToPages, buildMessagesQueryKey } from "@/shared/api/message-query";
import type { MessagePage } from "@/shared/api/api-client";

type MessagePagesData = InfiniteData<MessagePage, string | null> | undefined;
type MessageQuerySnapshot = readonly [QueryKey, MessagePagesData];

function isChannelMessagesQuery(queryKey: QueryKey, channelId: string): boolean {
  return (
    Array.isArray(queryKey) &&
    queryKey[0] === buildMessagesQueryKey("x", channelId)[0] &&
    queryKey[2] === channelId
  );
}

/**
 * 対象 channel の message query cache を全件取得する。
 */
export function snapshotChannelMessageQueries(
  queryClient: QueryClient,
  channelId: string,
): MessageQuerySnapshot[] {
  return queryClient.getQueriesData<InfiniteData<MessagePage, string | null> | undefined>({
    predicate: (query) => isChannelMessagesQuery(query.queryKey, channelId),
  });
}

/**
 * message snapshot を対象 channel の query cache へ反映する。
 */
export function applyMessageToChannelQueries(
  queryClient: QueryClient,
  channelId: string,
  message: Message,
): void {
  const snapshots = snapshotChannelMessageQueries(queryClient, channelId);
  for (const [queryKey] of snapshots) {
    queryClient.setQueryData<InfiniteData<MessagePage, string | null> | undefined>(
      queryKey,
      (current) => appendMessageToPages(current, message),
    );
  }
}

/**
 * 退避した query cache を復元する。
 */
export function restoreChannelMessageQueries(
  queryClient: QueryClient,
  snapshots: ReadonlyArray<MessageQuerySnapshot>,
): void {
  for (const [queryKey, data] of snapshots) {
    queryClient.setQueryData(queryKey, data);
  }
}

/**
 * 対象 channel の message query を再取得する。
 */
export function invalidateChannelMessages(queryClient: QueryClient, channelId: string) {
  return queryClient.invalidateQueries({
    predicate: (query) => isChannelMessagesQuery(query.queryKey, channelId),
  });
}
