// @vitest-environment jsdom
import { renderHook, waitFor } from "@/test/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import type { Message } from "@/shared/model/types";
import { useEditMessage } from "./use-edit-message";

const mockEditMessage = vi.fn().mockResolvedValue(undefined);

vi.mock("@/shared/api/api-client", () => ({
  getAPIClient: () => ({
    editMessage: mockEditMessage,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useEditMessage", () => {
  const message: Message = {
    id: "msg-1",
    channelId: "ch-1",
    author: {
      id: "user-1",
      username: "alice",
      displayName: "Alice",
      avatar: null,
      status: "online",
      customStatus: null,
      bot: false,
    },
    content: "before",
    timestamp: "2026-03-10T10:00:00Z",
    version: "2",
    editedTimestamp: null,
    isDeleted: false,
    type: 0,
    pinned: false,
    mentionEveryone: false,
    mentions: [],
    attachments: [],
    embeds: [],
    reactions: [],
    referencedMessage: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditMessage.mockResolvedValue(message);
  });

  it("passes expectedVersion to API", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEditMessage(), { wrapper });

    result.current.mutate({
      channelId: "ch-1",
      messageId: "msg-1",
      message,
      data: {
        content: "after",
        expectedVersion: "2",
      },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockEditMessage).toHaveBeenCalledWith("ch-1", "msg-1", {
      content: "after",
      expectedVersion: "2",
    });
  });
});
