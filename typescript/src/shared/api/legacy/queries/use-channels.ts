"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/legacy/api-client";

export function useChannels(serverId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["channels", serverId],
    queryFn: () => api.getChannels(serverId),
    enabled: !!serverId,
  });
}

export function useChannel(channelId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => api.getChannel(channelId),
    enabled: !!channelId,
  });
}

export function useDMChannels() {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["dm-channels"],
    queryFn: () => api.getDMChannels(),
  });
}
