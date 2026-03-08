"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function usePermissionSnapshot(serverId: string, params?: { channelId?: string | null }) {
  const api = getAPIClient();
  const channelId = params?.channelId?.trim() ?? "";

  return useQuery({
    queryKey: ["permission-snapshot", serverId, channelId],
    queryFn: () =>
      api.getPermissionSnapshot(serverId, {
        channelId: channelId.length > 0 ? channelId : null,
      }),
    enabled: serverId.trim().length > 0,
  });
}
