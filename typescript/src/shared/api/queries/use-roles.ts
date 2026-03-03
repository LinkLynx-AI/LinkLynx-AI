"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function useRoles(serverId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["roles", serverId],
    queryFn: () => api.getRoles(serverId),
    enabled: !!serverId,
  });
}
