// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { GuildChannelApiError } from "@/shared/api/guild-channel-api-client";
import { ChannelDeleteModal } from "./channel-delete-modal";

const mutateAsyncMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const usePathnameMock = vi.hoisted(() => vi.fn(() => "/channels/2001/3001"));
const useChannelsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@/shared/api/mutations/use-channel-actions", () => ({
  useDeleteChannel: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
}));

vi.mock("@/shared/api/queries/use-channels", () => ({
  useChannels: useChannelsMock,
}));

function createChannel(id: string, position: number) {
  return {
    id,
    guildId: "2001",
    type: 0 as const,
    name: `channel-${id}`,
    topic: null,
    position,
    parentId: null,
    nsfw: false,
    rateLimitPerUser: 0,
    lastMessageId: null,
  };
}

describe("ChannelDeleteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/channels/2001/3001");
    useChannelsMock.mockReturnValue({
      data: [createChannel("3001", 1), createChannel("3002", 2)],
    });
  });

  test("deletes channel and redirects to fallback when current channel is removed", async () => {
    mutateAsyncMock.mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    const onDeleted = vi.fn();

    render(
      <ChannelDeleteModal
        channelId="3001"
        channelName="general"
        onClose={onClose}
        onDeleted={onDeleted}
        serverId="2001"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "チャンネルを削除" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        serverId: "2001",
        channelId: "3001",
      });
      expect(replaceMock).toHaveBeenCalledWith("/channels/2001/3002");
      expect(onDeleted).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  test("shows mapped error message when deletion fails", async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      new GuildChannelApiError("denied", { code: "AUTHZ_DENIED" }),
    );
    const onClose = vi.fn();

    render(
      <ChannelDeleteModal
        channelId="3001"
        channelName="general"
        onClose={onClose}
        serverId="2001"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "チャンネルを削除" }));

    await waitFor(() => {
      expect(screen.getByText("この操作を行う権限がありません。")).not.toBeNull();
    });
    expect(replaceMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
