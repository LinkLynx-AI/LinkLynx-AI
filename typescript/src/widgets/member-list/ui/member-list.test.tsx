// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { useGuildStore } from "@/shared/model/stores/guild-store";
import { MemberList } from "./member-list";

const useMembersMock = vi.hoisted(() => vi.fn());
const useRolesMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries", () => ({
  useMembers: useMembersMock,
  useRoles: useRolesMock,
}));

describe("MemberList", () => {
  beforeEach(() => {
    useGuildStore.setState({
      activeServerId: "2001",
      activeChannelId: null,
      lastChannelPerServer: {},
      collapsedCategories: {},
      collapsedFolders: new Set(),
    });
    useMembersMock.mockReturnValue({
      data: [
        {
          user: {
            id: "1001",
            username: "Alice",
            displayName: "Alice",
            avatar: null,
            status: "offline",
            customStatus: "Ready",
            bot: false,
          },
          nick: "alice-owner",
          roles: ["owner"],
          joinedAt: "2026-03-03T00:00:00Z",
          avatar: null,
        },
      ],
    });
    useRolesMock.mockReturnValue({
      data: [
        {
          id: "owner",
          name: "Owner",
          color: "#99aab5",
          position: 300,
          permissions: 1,
          mentionable: false,
          hoist: true,
          memberCount: 1,
        },
      ],
    });
  });

  test("groups members by fetched role data instead of mock roles", () => {
    render(<MemberList />);

    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByRole("button", { name: /alice-owner/i })).toBeTruthy();
  });
});
