"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function useKickMember() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ serverId, userId }: { serverId: string; userId: string }) =>
      api.kickMember(serverId, userId),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["members", serverId] });
    },
  });
}

export function useBanMember() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      userId,
      deleteMessageDays,
    }: {
      serverId: string;
      userId: string;
      deleteMessageDays?: number;
    }) =>
      api.banMember(
        serverId,
        userId,
        deleteMessageDays != null ? { deleteMessageDays } : undefined,
      ),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["members", serverId] });
    },
  });
}

export function useTimeoutMember() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      userId,
      until,
    }: {
      serverId: string;
      userId: string;
      until: string | null;
    }) => api.timeoutMember(serverId, userId, until),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["members", serverId] });
    },
  });
}

export function useChangeNickname() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      userId,
      nickname,
    }: {
      serverId: string;
      userId: string;
      nickname: string;
    }) => api.updateMemberNickname(serverId, userId, nickname),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["members", serverId] });
    },
  });
}
