// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { ServerMembers } from "./server-members";

const useMembersMock = vi.hoisted(() => vi.fn());
const useRolesMock = vi.hoisted(() => vi.fn());
const useReplaceMemberRolesMock = vi.hoisted(() => vi.fn());
const mutateAsyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries", () => ({
  useMembers: useMembersMock,
  useRoles: useRolesMock,
}));

vi.mock("@/shared/api/mutations", () => ({
  useReplaceMemberRoles: useReplaceMemberRolesMock,
}));

describe("ServerMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMembersMock.mockReturnValue({
      data: [
        {
          user: {
            id: "1001",
            username: "alice",
            displayName: "Alice",
            avatar: null,
            status: "offline",
            customStatus: null,
            bot: false,
          },
          nick: "alice-owner",
          roles: ["member"],
          joinedAt: "2026-03-03T00:00:00Z",
          avatar: null,
        },
      ],
      isPending: false,
      isError: false,
    });
    useRolesMock.mockReturnValue({
      data: [
        {
          id: "member",
          name: "Member",
          color: "#99aab5",
          position: 100,
          permissions: 0,
          hoist: false,
          mentionable: false,
          memberCount: 1,
          allowView: true,
          allowPost: true,
          allowManage: false,
          isSystem: true,
        },
        {
          id: "reviewer",
          name: "Reviewer",
          color: "#99aab5",
          position: 90,
          permissions: 0,
          hoist: false,
          mentionable: false,
          memberCount: 0,
          allowView: true,
          allowPost: true,
          allowManage: false,
          isSystem: false,
        },
      ],
      isPending: false,
      isError: false,
    });
    useReplaceMemberRolesMock.mockReturnValue({
      isPending: false,
      mutateAsync: mutateAsyncMock,
    });
  });

  test("saves selected member role assignment", async () => {
    mutateAsyncMock.mockResolvedValue(undefined);

    render(<ServerMembers serverId="2001" />);

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[1] as HTMLButtonElement);
    await userEvent.click(screen.getByRole("button", { name: "ロールを保存" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        serverId: "2001",
        memberId: "1001",
        roleKeys: ["member", "reviewer"],
      });
    });
  });
});
