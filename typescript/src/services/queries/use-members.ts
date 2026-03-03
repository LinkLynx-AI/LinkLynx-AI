"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/services/api-client";

export function useMembers(serverId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["members", serverId],
    queryFn: () => api.getMembers(serverId),
    enabled: !!serverId,
  });
}
