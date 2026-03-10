// @vitest-environment jsdom
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@/test/test-utils";
import { useDeleteChannel } from "./use-channel-actions";

const mockDeleteChannel = vi.fn().mockResolvedValue(undefined);

vi.mock("@/shared/api/api-client", () => ({
  getAPIClient: () => ({
    createChannel: vi.fn(),
    deleteChannel: mockDeleteChannel,
  }),
}));

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useDeleteChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("removes deleted category descendants from list and detail caches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = createWrapper(queryClient);
    queryClient.setQueryData(
      ["channels", "2001"],
      [
        {
          id: "3100",
          guildId: "2001",
          type: 4,
          name: "times",
          topic: null,
          position: 0,
          parentId: null,
          nsfw: false,
          rateLimitPerUser: 0,
          lastMessageId: null,
        },
        {
          id: "3200",
          guildId: "2001",
          type: 0,
          name: "times-abe",
          topic: null,
          position: 1,
          parentId: "3100",
          nsfw: false,
          rateLimitPerUser: 0,
          lastMessageId: null,
        },
        {
          id: "3001",
          guildId: "2001",
          type: 0,
          name: "general",
          topic: null,
          position: 2,
          parentId: null,
          nsfw: false,
          rateLimitPerUser: 0,
          lastMessageId: null,
        },
      ],
    );
    queryClient.setQueryData(["channel", "3100"], { id: "3100" });
    queryClient.setQueryData(["channel", "3200"], { id: "3200" });
    queryClient.setQueryData(["channel", "3001"], { id: "3001" });

    const { result } = renderHook(() => useDeleteChannel(), { wrapper });

    result.current.mutate({ serverId: "2001", channelId: "3100" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockDeleteChannel).toHaveBeenCalledWith("3100");
    expect(queryClient.getQueryData(["channels", "2001"])).toEqual([
      {
        id: "3001",
        guildId: "2001",
        type: 0,
        name: "general",
        topic: null,
        position: 2,
        parentId: null,
        nsfw: false,
        rateLimitPerUser: 0,
        lastMessageId: null,
      },
    ]);
    expect(queryClient.getQueryData(["channel", "3100"])).toBeUndefined();
    expect(queryClient.getQueryData(["channel", "3200"])).toBeUndefined();
    expect(queryClient.getQueryData(["channel", "3001"])).toEqual({ id: "3001" });
  });
});
