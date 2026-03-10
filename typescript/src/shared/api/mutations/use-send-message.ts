"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import type { MessagePage, SendMessageParams } from "@/shared/api/api-client";
import { appendMessageToPages, buildMessagesQueryKey } from "../message-query";

export function useSendMessage() {
  const queryClient = useQueryClient();
  const api = getAPIClient();

  return useMutation({
    mutationFn: (params: SendMessageParams) => api.sendMessage(params),
    onSuccess: (message, { guildId, channelId }) => {
      queryClient.setQueryData<InfiniteData<MessagePage, string | null> | undefined>(
        buildMessagesQueryKey(guildId, channelId),
        (current) => appendMessageToPages(current, message),
      );
    },
  });
}
