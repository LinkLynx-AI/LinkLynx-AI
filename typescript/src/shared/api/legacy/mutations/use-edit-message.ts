"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/legacy/api-client";
import type { EditMessageData } from "@/shared/model/legacy/types/message";

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
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });
}
