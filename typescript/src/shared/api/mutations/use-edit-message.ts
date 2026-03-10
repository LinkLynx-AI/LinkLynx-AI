"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { EditMessageData } from "@/shared/model/types/message";

function invalidateChannelMessages(
  queryClient: ReturnType<typeof useQueryClient>,
  channelId: string,
) {
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

export function useEditMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: ({
      channelId,
      messageId,
      data,
    }: {
      channelId: string;
      messageId: string;
      data: EditMessageData;
    }) => api.editMessage(channelId, messageId, data),
    onSuccess: (_, { channelId }) => {
      void invalidateChannelMessages(queryClient, channelId);
    },
  });
}
