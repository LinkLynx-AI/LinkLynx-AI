"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function useAuditLog(serverId: string, params?: { before?: string; limit?: number }) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["audit-log", serverId, params],
    queryFn: () => api.getAuditLog(serverId, params),
    enabled: !!serverId,
  });
}
