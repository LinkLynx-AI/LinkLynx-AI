"use client";

import { useQuery } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function useUserProfile(userId: string | null) {
  const api = getAPIClient();
  return useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => api.getUserProfile(userId!),
    enabled: !!userId,
  });
}
