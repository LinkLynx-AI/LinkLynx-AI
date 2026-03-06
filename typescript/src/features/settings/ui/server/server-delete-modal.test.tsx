// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { GuildChannelApiError } from "@/shared/api/guild-channel-api-client";
import { ServerDeleteModal } from "./server-delete-modal";
import type { ReactNode } from "react";

const replaceMock = vi.hoisted(() => vi.fn());
const usePathnameMock = vi.hoisted(() => vi.fn(() => "/channels/2001/3001"));
const mockDeleteServer = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@/shared/api/api-client", () => ({
  getAPIClient: () => ({
    deleteServer: mockDeleteServer,
  }),
}));

function createServer(id: string, name: string) {
  return {
    id,
    name,
    icon: null,
    banner: null,
    ownerId: "1001",
    memberCount: 1,
    boostLevel: 0,
    boostCount: 0,
    features: [],
    description: null,
  };
}

function createChannel(id: string) {
  return {
    id,
    guildId: "2001",
    type: 0 as const,
    name: `channel-${id}`,
    topic: null,
    position: 0,
    parentId: null,
    nsfw: false,
    rateLimitPerUser: 0,
    lastMessageId: null,
  };
}

function renderWithQueryClient(queryClient: QueryClient, node: ReactNode) {
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe("ServerDeleteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/channels/2001/3001");
  });

  test("deletes current server, clears caches, and redirects to next server", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(
      ["servers"],
      [createServer("2001", "LinkLynx Developers"), createServer("2002", "Design Hub")],
    );
    queryClient.setQueryData(["server", "2001"], createServer("2001", "LinkLynx Developers"));
    queryClient.setQueryData(["channels", "2001"], [createChannel("3001")]);
    queryClient.setQueryData(["channel", "3001"], createChannel("3001"));
    const onClose = vi.fn();
    const onDeleted = vi.fn();

    renderWithQueryClient(
      queryClient,
      <ServerDeleteModal
        onClose={onClose}
        onDeleted={onDeleted}
        serverId="2001"
        serverName="LinkLynx Developers"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "サーバーを削除" }));

    await waitFor(() => {
      expect(mockDeleteServer).toHaveBeenCalledWith("2001");
      expect(replaceMock).toHaveBeenCalledWith("/channels/2002");
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });

    expect(queryClient.getQueryData(["servers"])).toEqual([createServer("2002", "Design Hub")]);
    expect(queryClient.getQueryData(["server", "2001"])).toBeUndefined();
    expect(queryClient.getQueryData(["channels", "2001"])).toBeUndefined();
    expect(queryClient.getQueryData(["channel", "3001"])).toBeUndefined();
  });

  test("falls back to DM route when no servers remain", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(["servers"], [createServer("2001", "Solo Server")]);

    renderWithQueryClient(
      queryClient,
      <ServerDeleteModal onClose={() => undefined} serverId="2001" serverName="Solo Server" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "サーバーを削除" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/channels/me");
    });
  });

  test("does not redirect when deleting a non-selected server", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(
      ["servers"],
      [createServer("2001", "LinkLynx Developers"), createServer("2002", "Design Hub")],
    );
    usePathnameMock.mockReturnValue("/channels/2002/4001");

    renderWithQueryClient(
      queryClient,
      <ServerDeleteModal
        onClose={() => undefined}
        serverId="2001"
        serverName="LinkLynx Developers"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "サーバーを削除" }));

    await waitFor(() => {
      expect(mockDeleteServer).toHaveBeenCalledWith("2001");
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test("shows mapped error message when deletion fails", async () => {
    mockDeleteServer.mockRejectedValueOnce(
      new GuildChannelApiError("missing", { code: "GUILD_NOT_FOUND" }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(["servers"], [createServer("2001", "LinkLynx Developers")]);

    renderWithQueryClient(
      queryClient,
      <ServerDeleteModal
        onClose={() => undefined}
        serverId="2001"
        serverName="LinkLynx Developers"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "サーバーを削除" }));

    await waitFor(() => {
      expect(screen.getByText("対象のサーバーが見つかりません。")).not.toBeNull();
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
