"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

/**
 * channel permission override 一覧を取得する。
 */
export function useChannelPermissions(serverId: string, channelId: string, enabled = true) {
  const api = getAPIClient();

  return useQuery({
    queryKey: ["channel-permissions", serverId, channelId],
    queryFn: () => api.getChannelPermissions(serverId, channelId),
    enabled: enabled && serverId.trim().length > 0 && channelId.trim().length > 0,
  });
}
