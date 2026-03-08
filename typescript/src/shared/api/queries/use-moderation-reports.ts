"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { InfiniteData, UseInfiniteQueryResult, UseQueryResult } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type {
  ModerationReport,
  ModerationReportListPage,
  ModerationReportListParams,
} from "@/shared/api/api-client";

/**
 * モデレーション通報一覧を取得する。
 */
export function useModerationReports(
  serverId: string,
  options?: { enabled?: boolean; params?: ModerationReportListParams },
): UseInfiniteQueryResult<InfiniteData<ModerationReportListPage>, Error> {
  const api = getAPIClient();
  return useInfiniteQuery({
    queryKey: [
      "moderation-reports",
      serverId,
      options?.params?.status ?? null,
      options?.params?.limit ?? null,
    ],
    queryFn: ({ pageParam }) =>
      api.getModerationReports(serverId, {
        ...options?.params,
        after: typeof pageParam === "string" ? pageParam : null,
      }),
    initialPageParam: options?.params?.after ?? null,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasMore ? (lastPage.pageInfo.nextAfter ?? undefined) : undefined,
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
): UseQueryResult<ModerationReport, Error> {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["moderation-report", serverId, reportId],
    queryFn: () => api.getModerationReport(serverId, reportId),
    enabled: (options?.enabled ?? true) && serverId.trim().length > 0 && reportId.trim().length > 0,
  });
}
