"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { UpdateMyProfileInput } from "@/shared/api/api-client";
import {
  syncMyProfileToAuthStore,
  syncMyProfileToSessionCaches,
} from "@/shared/api/my-profile-sync";

/**
 * ログインユーザーのプロフィールを更新する。
 */
export function useUpdateMyProfile(userId: string | null) {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: (input: UpdateMyProfileInput) => api.updateMyProfile(input),
    onSuccess: (updatedProfile) => {
      if (userId !== null) {
        syncMyProfileToSessionCaches(queryClient, userId, updatedProfile);
        return;
      }

      syncMyProfileToAuthStore(updatedProfile);
    },
  });
}
