"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

/**
 * permission snapshot を取得する。
 *
 * Contract:
 * - guild 単位の snapshot を基本とし、必要な場合のみ channel snapshot を追加取得する
 * - `enabled` が false の間は fail-close な上位 guard が判定を保留する
 */
export function usePermissionSnapshot(
  serverId: string,
  params?: { channelId?: string | null; enabled?: boolean },
) {
  const api = getAPIClient();
  const channelId = params?.channelId?.trim() ?? "";
  const enabled = params?.enabled ?? true;

  return useQuery({
    queryKey: ["permission-snapshot", serverId, channelId],
    queryFn: () =>
      api.getPermissionSnapshot(serverId, {
        channelId: channelId.length > 0 ? channelId : null,
      }),
    enabled: enabled && serverId.trim().length > 0,
  });
}
