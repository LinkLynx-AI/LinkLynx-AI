"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient, type ProfileMediaTarget } from "@/shared/api/api-client";

/**
 * 自分のプロフィール media key から署名付き download URL を取得する。
 */
export function useMyProfileMediaDownloadUrl(target: ProfileMediaTarget, objectKey: string | null) {
  const api = getAPIClient();

  return useQuery({
    queryKey: ["myProfileMediaDownloadUrl", target, objectKey],
    queryFn: async () => {
      const media = await api.getMyProfileMediaDownloadUrl(target);
      return media.downloadUrl;
    },
    enabled: objectKey !== null,
    retry: false,
  });
}
