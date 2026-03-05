"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

export function useCreateModerationReport() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      targetType,
      targetId,
      reason,
    }: {
      serverId: string;
      targetType: "message" | "user";
      targetId: string;
      reason: string;
    }) =>
      api.createModerationReport(serverId, {
        targetType,
        targetId,
        reason,
      }),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ["moderation-reports", serverId] });
    },
  });
}

export function useResolveModerationReport() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ serverId, reportId }: { serverId: string; reportId: string }) =>
      api.resolveModerationReport(serverId, reportId),
    onSuccess: (_, { serverId, reportId }) => {
      queryClient.invalidateQueries({ queryKey: ["moderation-reports", serverId] });
      queryClient.invalidateQueries({ queryKey: ["moderation-report", serverId, reportId] });
    },
  });
}

export function useReopenModerationReport() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ serverId, reportId }: { serverId: string; reportId: string }) =>
      api.reopenModerationReport(serverId, reportId),
    onSuccess: (_, { serverId, reportId }) => {
      queryClient.invalidateQueries({ queryKey: ["moderation-reports", serverId] });
      queryClient.invalidateQueries({ queryKey: ["moderation-report", serverId, reportId] });
    },
  });
}

export function useCreateModerationMute() {
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      serverId,
      targetUserId,
      reason,
      expiresAt,
    }: {
      serverId: string;
      targetUserId: string;
      reason: string;
      expiresAt?: string | null;
    }) =>
      api.createModerationMute(serverId, {
        targetUserId,
        reason,
        expiresAt,
      }),
  });
}
