"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { CreateInviteData } from "@/shared/api/api-client";

export function useCreateInvite() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      channelId,
      data,
    }: {
      serverId: string;
      channelId: string;
      data: CreateInviteData;
    }) => api.createInvite(serverId, channelId, data),
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
