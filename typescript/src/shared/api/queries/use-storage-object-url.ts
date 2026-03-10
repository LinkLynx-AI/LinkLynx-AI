"use client";

import { useQuery } from "@tanstack/react-query";
import { getStorageObjectUrl } from "@/shared/lib";

/**
 * Storage object key からダウンロード URL を取得する。
 */
export function useStorageObjectUrl(objectKey: string | null) {
  return useQuery({
    queryKey: ["storageObjectUrl", objectKey],
    queryFn: () => getStorageObjectUrl(objectKey!),
    enabled: objectKey !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
