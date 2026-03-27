"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { ReplaceChannelPermissionsInput } from "@/shared/api/api-client";

export function useReplaceMemberRoles() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      memberId,
      roleKeys,
    }: {
      serverId: string;
      memberId: string;
      roleKeys: string[];
    }) => api.replaceMemberRoles(serverId, memberId, roleKeys),
    onSuccess: (member, { serverId, memberId }) => {
      queryClient.setQueryData(["member", serverId, memberId], member);
      queryClient.invalidateQueries({ queryKey: ["members", serverId] });
      queryClient.invalidateQueries({ queryKey: ["roles", serverId] });
    },
  });
}

export function useReplaceChannelPermissions() {
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
      data: ReplaceChannelPermissionsInput;
    }) => api.replaceChannelPermissions(serverId, channelId, data),
    onSuccess: (permissions, { serverId, channelId }) => {
      queryClient.setQueryData(["channel-permissions", serverId, channelId], permissions);
      queryClient.invalidateQueries({ queryKey: ["permission-snapshot", serverId] });
      queryClient.invalidateQueries({ queryKey: ["permission-snapshot", serverId, channelId] });
    },
  });
}
