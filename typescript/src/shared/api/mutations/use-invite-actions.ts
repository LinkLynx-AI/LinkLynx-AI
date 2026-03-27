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
    onSuccess: (_invite, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invites", variables.serverId] });
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ serverId, inviteCode }: { serverId: string; inviteCode: string }) =>
      api.revokeInvite(serverId, inviteCode),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invites", variables.serverId] });
    },
  });
}
