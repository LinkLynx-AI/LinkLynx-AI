"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

/**
 * モデレーション通報一覧を取得する。
 */
export function useModerationReports(serverId: string, options?: { enabled?: boolean }) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["moderation-reports", serverId],
    queryFn: () => api.getModerationReports(serverId),
    enabled: (options?.enabled ?? true) && serverId.trim().length > 0,
  });
}

/**
 * モデレーション通報詳細を取得する。
 */
export function useModerationReport(
  serverId: string,
  reportId: string,
  options?: { enabled?: boolean },
) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["moderation-report", serverId, reportId],
    queryFn: () => api.getModerationReport(serverId, reportId),
    enabled: (options?.enabled ?? true) && serverId.trim().length > 0 && reportId.trim().length > 0,
  });
}
