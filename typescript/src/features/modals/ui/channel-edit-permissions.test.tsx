// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { ChannelEditPermissions } from "./channel-edit-permissions";

const useActionGuardMock = vi.hoisted(() => vi.fn());
const useRolesMock = vi.hoisted(() => vi.fn());
const useMembersMock = vi.hoisted(() => vi.fn());
const useChannelPermissionsMock = vi.hoisted(() => vi.fn());
const useReplaceChannelPermissionsMock = vi.hoisted(() => vi.fn());
const mutateAsyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries", () => ({
  useActionGuard: useActionGuardMock,
  useRoles: useRolesMock,
  useMembers: useMembersMock,
  useChannelPermissions: useChannelPermissionsMock,
  getActionGuardScreenKind: (status: string) => {
    if (status === "forbidden") {
      return "forbidden";
    }
    if (status === "unavailable") {
      return "service-unavailable";
    }
    return null;
  },
}));

vi.mock("@/shared/api/mutations", () => ({
  useReplaceChannelPermissions: useReplaceChannelPermissionsMock,
}));

describe("ChannelEditPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActionGuardMock.mockReturnValue({
      status: "allowed",
      isAllowed: true,
      message: null,
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
      ],
      isPending: false,
      isError: false,
    });
    useMembersMock.mockReturnValue({
      data: [
        {
          user: {
            id: "1002",
            username: "bob",
            displayName: "Bob",
            avatar: null,
            status: "offline",
            customStatus: null,
            bot: false,
          },
          nick: null,
          roles: ["member"],
          joinedAt: "2026-03-03T00:00:00Z",
          avatar: null,
        },
      ],
      isPending: false,
      isError: false,
    });
    useChannelPermissionsMock.mockReturnValue({
      data: {
        roleOverrides: [
          {
            roleKey: "member",
            subjectName: "@everyone",
            isSystem: true,
            canView: "allow",
            canPost: "deny",
          },
        ],
        userOverrides: [],
      },
      isPending: false,
      isError: false,
    });
    useReplaceChannelPermissionsMock.mockReturnValue({
      isPending: false,
      mutateAsync: mutateAsyncMock,
    });
  });

  test("saves current override draft with backend tri-state payload", async () => {
    mutateAsyncMock.mockResolvedValue(undefined);

    render(<ChannelEditPermissions serverId="2001" channelId="3001" />);

    await userEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        serverId: "2001",
        channelId: "3001",
        data: {
          roleOverrides: [
            {
              roleKey: "member",
              canView: "allow",
              canPost: "deny",
            },
          ],
          userOverrides: [],
        },
      });
    });
  });

  test("renders route guard screen when permission is forbidden", () => {
    useActionGuardMock.mockReturnValue({
      status: "forbidden",
      isAllowed: false,
      message: "この操作を行う権限がありません。",
    });

    render(<ChannelEditPermissions serverId="2001" channelId="3001" />);

    expect(screen.getByText("アクセス権限がありません")).not.toBeNull();
  });

  test("renders service unavailable guard screen when authz is unavailable", () => {
    useActionGuardMock.mockReturnValue({
      status: "unavailable",
      isAllowed: false,
      message: "認可基盤が一時的に利用できません。",
    });

    render(<ChannelEditPermissions serverId="2001" channelId="3001" />);

    expect(screen.getByText("認証基盤が一時的に利用できません")).not.toBeNull();
  });
});
