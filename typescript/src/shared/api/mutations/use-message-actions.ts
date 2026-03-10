"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";

function invalidateChannelMessages(queryClient: ReturnType<typeof useQueryClient>, channelId: string) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return (
        Array.isArray(queryKey) &&
        queryKey[0] === "messages" &&
        typeof queryKey[2] === "string" &&
        queryKey[2] === channelId
      );
    },
  });
}

export function usePinMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ channelId, messageId }: { channelId: string; messageId: string }) =>
      api.pinMessage(channelId, messageId),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({
        queryKey: ["pinned-messages", channelId],
      });
      void invalidateChannelMessages(queryClient, channelId);
    },
  });
}

export function useUnpinMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ channelId, messageId }: { channelId: string; messageId: string }) =>
      api.unpinMessage(channelId, messageId),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({
        queryKey: ["pinned-messages", channelId],
      });
      void invalidateChannelMessages(queryClient, channelId);
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({ channelId, messageId }: { channelId: string; messageId: string }) =>
      api.deleteMessage(channelId, messageId),
    onSuccess: (_, { channelId }) => {
      void invalidateChannelMessages(queryClient, channelId);
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
      void invalidateChannelMessages(queryClient, channelId);
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
      void invalidateChannelMessages(queryClient, channelId);
    },
  });
}
