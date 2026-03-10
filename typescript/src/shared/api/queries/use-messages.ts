"use client";

import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import {
  buildMessagesQueryKey,
  DEFAULT_MESSAGE_PAGE_LIMIT,
  flattenMessagePages,
} from "../message-query";

export function useMessages(guildId: string | null | undefined, channelId: string) {
  const api = getAPIClient();
  const enabled =
    typeof guildId === "string" && guildId.trim().length > 0 && channelId.trim().length > 0;

  const query = useInfiniteQuery({
    queryKey: buildMessagesQueryKey(guildId ?? "disabled", channelId),
    queryFn: ({ pageParam }) =>
      api.getMessages({
        guildId: guildId ?? "",
        channelId,
        before: pageParam ?? undefined,
        limit: DEFAULT_MESSAGE_PAGE_LIMIT,
      }),
    enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
  });

  const messages = useMemo(
    () => (query.data === undefined ? [] : flattenMessagePages(query.data.pages)),
    [query.data],
  );

  const loadOlder = useCallback(async () => {
    if (!query.hasNextPage || query.isFetchingNextPage) {
      return;
    }

    await query.fetchNextPage();
  }, [query]);

  return {
    ...query,
    messages,
    hasMore: Boolean(query.hasNextPage),
    loadOlder,
  };
}

export function usePinnedMessages(channelId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["pinned-messages", channelId],
    queryFn: () => api.getPinnedMessages(channelId),
    enabled: !!channelId,
  });
}
