import { renderHook, waitFor } from "@/test/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePinMessage, useDeleteMessage } from "./use-message-actions";
import { createElement } from "react";

const mockPinMessage = vi.fn().mockResolvedValue(undefined);
const mockDeleteMessage = vi.fn().mockResolvedValue(undefined);

vi.mock("@/services/api-client", () => ({
  getAPIClient: () => ({
    pinMessage: mockPinMessage,
    unpinMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: mockDeleteMessage,
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useMessageActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usePinMessage calls API", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePinMessage(), { wrapper });

    result.current.mutate({ channelId: "ch-1", messageId: "msg-1" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockPinMessage).toHaveBeenCalledWith("ch-1", "msg-1");
  });

  it("useDeleteMessage calls API and invalidates queries", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteMessage(), { wrapper });

    result.current.mutate({ channelId: "ch-1", messageId: "msg-1" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockDeleteMessage).toHaveBeenCalledWith("ch-1", "msg-1");
  });
});
