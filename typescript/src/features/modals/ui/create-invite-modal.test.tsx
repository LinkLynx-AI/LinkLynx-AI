// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { CreateInviteModal } from "./create-invite-modal";

const useCreateInviteMock = vi.hoisted(() => vi.fn());
const useChannelsMock = vi.hoisted(() => vi.fn());
const useActionGuardMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/mutations", () => ({
  useCreateInvite: useCreateInviteMock,
}));

vi.mock("@/shared/api/queries", () => ({
  useChannels: useChannelsMock,
  useActionGuard: useActionGuardMock,
}));

describe("CreateInviteModal", () => {
  test("creates invite and shows shareable link", async () => {
    const onClose = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({
      code: "DEVCREATE2026",
      guild: {
        id: "2001",
        name: "LinkLynx Developers",
        icon: null,
        banner: null,
        ownerId: "1001",
        memberCount: 1,
        boostLevel: 0,
        boostCount: 0,
        features: [],
        description: null,
      },
      channel: {
        id: "3001",
        guildId: "2001",
        type: 0,
        name: "general",
        topic: null,
        position: 0,
        parentId: null,
        nsfw: false,
        rateLimitPerUser: 0,
        lastMessageId: null,
      },
      expiresAt: null,
      uses: 0,
      maxUses: 0,
    });
    useCreateInviteMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    useChannelsMock.mockReturnValue({
      data: [
        {
          id: "3001",
          guildId: "2001",
          type: 0,
          name: "general",
          topic: null,
          position: 0,
          parentId: null,
          nsfw: false,
          rateLimitPerUser: 0,
          lastMessageId: null,
        },
      ],
      isPending: false,
    });
    useActionGuardMock.mockReturnValue({
      status: "allowed",
      isAllowed: true,
      message: null,
    });

    render(<CreateInviteModal onClose={onClose} serverId="2001" channelId="3001" />);

    await userEvent.click(screen.getByRole("button", { name: "招待を作成" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      serverId: "2001",
      channelId: "3001",
      data: {
        maxAge: 86400,
        maxUses: undefined,
      },
    });
    expect(screen.getByDisplayValue(/DEVCREATE2026/)).not.toBeNull();
    expect(screen.getByText("招待リンク")).not.toBeNull();
  });

  test("allows closing without creating", async () => {
    const onClose = vi.fn();
    useCreateInviteMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useChannelsMock.mockReturnValue({
      data: [],
      isPending: false,
    });
    useActionGuardMock.mockReturnValue({
      status: "forbidden",
      isAllowed: false,
      message: "この操作を行う権限がありません。",
    });

    render(<CreateInviteModal onClose={onClose} serverId="2001" />);

    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
