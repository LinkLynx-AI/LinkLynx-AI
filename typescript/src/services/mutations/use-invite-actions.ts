"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/services/api-client";
import type { CreateInviteData } from "@/services/api-client";

export function useCreateInvite() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      channelId,
      data,
    }: {
      channelId: string;
      data: CreateInviteData;
    }) => api.createInvite(channelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: (inviteCode: string) => api.revokeInvite(inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
  });
}
