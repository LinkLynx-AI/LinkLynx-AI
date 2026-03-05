"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

/**
 * ログインユーザーのプロフィールを取得する。
 */
export function useMyProfile(userId: string | null) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["myProfile", userId],
    queryFn: () => api.getMyProfile(),
    enabled: userId !== null,
  });
}
