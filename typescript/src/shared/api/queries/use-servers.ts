"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function useServers() {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["servers"],
    queryFn: () => api.getServers(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useServer(serverId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["server", serverId],
    queryFn: () => api.getServer(serverId),
    enabled: !!serverId,
  });
}
