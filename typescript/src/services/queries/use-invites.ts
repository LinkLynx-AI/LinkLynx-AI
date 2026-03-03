"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/services/api-client";

export function useInvites(serverId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["invites", serverId],
    queryFn: () => api.getInvites(serverId),
    enabled: !!serverId,
  });
}
