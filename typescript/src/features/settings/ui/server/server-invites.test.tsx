// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { ServerInvites } from "./server-invites";

const useInvitesMock = vi.hoisted(() => vi.fn());
const useRevokeInviteMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries/use-invites", () => ({
  useInvites: useInvitesMock,
}));

vi.mock("@/shared/api/mutations", () => ({
  useRevokeInvite: useRevokeInviteMock,
}));

describe("ServerInvites", () => {
  test("renders invite rows with channel metadata and revokes guild-scoped invite", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    useInvitesMock.mockReturnValue({
      data: [
        {
          code: "DEVJOIN2026",
          channel: { id: "3001", name: "general" },
          creator: { id: "1001", displayName: "Alice" },
          expiresAt: null,
          uses: 3,
          maxUses: 10,
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

    render(<ServerInvites serverId="2001" />);

    expect(screen.getByText("DEVJOIN2026")).not.toBeNull();
    expect(screen.getByText("#general")).not.toBeNull();
    expect(screen.getByText("Alice")).not.toBeNull();
    expect(screen.queryByText("招待一覧の取得に失敗しました。")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      serverId: "2001",
      inviteCode: "DEVJOIN2026",
    });
  });

  test("renders empty state when no active invites exist", () => {
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

    render(<ServerInvites serverId="2001" />);

    expect(screen.getByText("有効な招待はありません")).not.toBeNull();
  });

  test("renders query error only when invite fetch fails", () => {
    useInvitesMock.mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error("招待一覧の取得に失敗しました。"),
    });
    useRevokeInviteMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    });

    render(<ServerInvites serverId="2001" />);

    expect(screen.getByText("招待一覧の取得に失敗しました。")).not.toBeNull();
  });
});
