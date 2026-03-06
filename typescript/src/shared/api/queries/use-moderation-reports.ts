"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function useModerationReports(serverId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["moderation-reports", serverId],
    queryFn: () => api.getModerationReports(serverId),
    enabled: serverId.trim().length > 0,
  });
}

export function useModerationReport(serverId: string, reportId: string) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["moderation-report", serverId, reportId],
    queryFn: () => api.getModerationReport(serverId, reportId),
    enabled: serverId.trim().length > 0 && reportId.trim().length > 0,
  });
}
