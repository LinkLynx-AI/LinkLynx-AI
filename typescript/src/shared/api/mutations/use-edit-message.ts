"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { EditMessageData, Message } from "@/shared/model/types/message";
import {
  applyMessageToChannelQueries,
  invalidateChannelMessages,
  restoreChannelMessageQueries,
  snapshotChannelMessageQueries,
} from "./message-cache";

export function useEditMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      channelId,
      messageId,
      data,
      message,
    }: {
      channelId: string;
      messageId: string;
      data: EditMessageData;
      message: Message;
    }) => api.editMessage(channelId, messageId, data),
    onMutate: async ({ channelId, data, message }) => {
      await queryClient.cancelQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[2] === channelId,
      });
      const snapshots = snapshotChannelMessageQueries(queryClient, channelId);
      applyMessageToChannelQueries(queryClient, channelId, {
        ...message,
        content: data.content,
        editedTimestamp: new Date().toISOString(),
      });
      return { channelId, snapshots };
    },
    onError: (_error, _variables, context) => {
      if (context !== undefined) {
        restoreChannelMessageQueries(queryClient, context.snapshots);
      }
    },
    onSuccess: (updatedMessage, { channelId }) => {
      applyMessageToChannelQueries(queryClient, channelId, updatedMessage);
    },
    onSettled: (_data, _error, { channelId }) => {
      void invalidateChannelMessages(queryClient, channelId);
    },
  });
}
