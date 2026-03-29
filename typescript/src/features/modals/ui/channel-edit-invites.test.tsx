// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { GuildChannelApiError } from "@/shared/api/guild-channel-api-client";
import { render, screen, userEvent } from "@/test/test-utils";
import { ChannelEditInvites } from "./channel-edit-invites";

const useInvitesMock = vi.hoisted(() => vi.fn());
const useRevokeInviteMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries/use-invites", () => ({
  useInvites: useInvitesMock,
}));

vi.mock("@/shared/api/mutations", () => ({
  useRevokeInvite: useRevokeInviteMock,
}));

describe("ChannelEditInvites", () => {
  test("loads channel-scoped invites and revokes with channel id", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    useInvitesMock.mockReturnValue({
      data: [
        {
          code: "DEVJOIN2026",
          channel: { id: "3001", name: "general" },
          creator: { id: "1001", displayName: "Alice" },
          expiresAt: null,
          uses: 2,
          maxUses: null,
          createdAt: "2026-03-14T00:00:00Z",
        },
      ],
      isPending: false,
      error: null,
    });
    useRevokeInviteMock.mockReturnValue({
      mutateAsync,
      isPending: false,
      variables: undefined,
    });

    render(<ChannelEditInvites serverId="2001" channelId="3001" />);

    expect(useInvitesMock).toHaveBeenCalledWith("2001", "3001");
    expect(screen.queryByText(/サーバー単位で管理/)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "招待を取り消す" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      serverId: "2001",
      inviteCode: "DEVJOIN2026",
      channelId: "3001",
    });
  });

  test("renders empty state when invite list is empty", () => {
    useInvitesMock.mockReturnValue({
      data: [],
      isPending: false,
      error: null,
    });
    useRevokeInviteMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    });

    render(<ChannelEditInvites serverId="2001" channelId="3001" />);

    expect(screen.getByText("招待がありません")).not.toBeNull();
    expect(screen.getByText("このチャンネルにはアクティブな招待がありません")).not.toBeNull();
  });

  test("maps invite fetch error with request id", () => {
    useInvitesMock.mockReturnValue({
      data: undefined,
      isPending: false,
      error: new GuildChannelApiError("この操作を行う権限がありません。", {
        status: 403,
        code: "AUTHZ_DENIED",
        requestId: "req-channel-invites-403",
      }),
    });
    useRevokeInviteMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    });

    render(<ChannelEditInvites serverId="2001" channelId="3001" />);

    expect(
      screen.getByText("この操作を行う権限がありません。 (request_id: req-channel-invites-403)"),
    ).not.toBeNull();
  });
});
