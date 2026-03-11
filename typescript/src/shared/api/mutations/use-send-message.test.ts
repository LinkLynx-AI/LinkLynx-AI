// @vitest-environment jsdom
import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@/test/test-utils";
import type { MessagePage } from "@/shared/api/api-client";
import { buildMessagesQueryKey } from "@/shared/api/message-query";
import { useSendMessage } from "./use-send-message";

const mockSendMessage = vi.fn();

vi.mock("@/shared/api/api-client", () => ({
  getAPIClient: () => ({
    sendMessage: mockSendMessage,
  }),
}));

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useSendMessage", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
  });

  it("updates the matching message query cache on success", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData<InfiniteData<MessagePage, string | null>>(
      buildMessagesQueryKey("2001", "3001"),
      {
        pageParams: [null],
        pages: [
          {
            items: [],
            nextBefore: null,
            nextAfter: null,
            hasMore: false,
          },
        ],
      },
    );
    mockSendMessage.mockResolvedValue({
      id: "5001",
      channelId: "3001",
      author: {
        id: "9003",
        username: "alice",
        displayName: "Alice",
        avatar: null,
        status: "online",
        customStatus: null,
        bot: false,
      },
      content: "hello",
      timestamp: "2026-03-10T10:00:00Z",
      editedTimestamp: null,
      type: 0,
      pinned: false,
      mentionEveryone: false,
      mentions: [],
      attachments: [],
      embeds: [],
      reactions: [],
      referencedMessage: null,
    });

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useSendMessage(), { wrapper });

    result.current.mutate({
      guildId: "2001",
      channelId: "3001",
      data: { content: "hello" },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const cached = queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(
      buildMessagesQueryKey("2001", "3001"),
    );
    expect(cached?.pages[0]?.items).toEqual([
      expect.objectContaining({
        id: "5001",
        content: "hello",
      }),
    ]);
  });
});
