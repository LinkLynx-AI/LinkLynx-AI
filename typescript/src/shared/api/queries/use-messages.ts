"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function useMessages(channelId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["messages", channelId],
    queryFn: () => api.getMessages(channelId),
    enabled: !!channelId,
  });
}

export function usePinnedMessages(channelId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["pinned-messages", channelId],
    queryFn: () => api.getPinnedMessages(channelId),
    enabled: !!channelId,
  });
}
