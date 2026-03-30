"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function useInvites(serverId: string, channelId?: string) {
  const api = getAPIClient();
  const normalizedChannelId = channelId?.trim() || undefined;

  return useQuery({
    queryKey: ["invites", serverId, normalizedChannelId ?? null],
    queryFn: () => api.getInvites(serverId, { channelId: normalizedChannelId }),
    enabled: !!serverId,
  });
}
