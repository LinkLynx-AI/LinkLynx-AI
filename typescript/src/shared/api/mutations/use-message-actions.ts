"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { Message } from "@/shared/model/types";
import {
  applyMessageToChannelQueries,
  invalidateChannelMessages,
  restoreChannelMessageQueries,
  snapshotChannelMessageQueries,
} from "./message-cache";

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
    mutationFn: ({
      channelId,
      messageId,
      message,
    }: {
      channelId: string;
      messageId: string;
      message: Message;
    }) =>
      api.deleteMessage(channelId, messageId, {
        expectedVersion: message.version,
      }),
    onMutate: async ({ channelId, message }) => {
      await queryClient.cancelQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "messages" &&
          query.queryKey[2] === channelId,
      });
      const snapshots = snapshotChannelMessageQueries(queryClient, channelId);
      applyMessageToChannelQueries(queryClient, channelId, {
        ...message,
        content: "",
        editedTimestamp: new Date().toISOString(),
        isDeleted: true,
        version: String(Number(message.version) + 1),
      });
      return { channelId, snapshots };
    },
    onError: (_error, _variables, context) => {
      if (context !== undefined) {
        restoreChannelMessageQueries(queryClient, context.snapshots);
      }
    },
    onSuccess: (deletedMessage, { channelId }) => {
      applyMessageToChannelQueries(queryClient, channelId, deletedMessage);
    },
    onSettled: (_data, _error, { channelId }) => {
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
