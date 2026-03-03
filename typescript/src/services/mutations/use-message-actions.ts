"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/services/api-client";

export function usePinMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      channelId,
      messageId,
    }: {
      channelId: string;
      messageId: string;
    }) => api.pinMessage(channelId, messageId),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({
        queryKey: ["pinned-messages", channelId],
      });
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });
}

export function useUnpinMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      channelId,
      messageId,
    }: {
      channelId: string;
      messageId: string;
    }) => api.unpinMessage(channelId, messageId),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({
        queryKey: ["pinned-messages", channelId],
      });
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      channelId,
      messageId,
    }: {
      channelId: string;
      messageId: string;
    }) => api.deleteMessage(channelId, messageId),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });
}

export function useAddReaction() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      channelId,
      messageId,
      emoji,
    }: {
      channelId: string;
      messageId: string;
      emoji: string;
    }) => api.addReaction(channelId, messageId, emoji),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });
}

export function useRemoveReaction() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      channelId,
      messageId,
      emoji,
    }: {
      channelId: string;
      messageId: string;
      emoji: string;
    }) => api.removeReaction(channelId, messageId, emoji),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });
}
