// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { useGuildStore } from "@/shared/model/stores/guild-store";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { ProfilePopout } from "./profile-popout";

const useMembersMock = vi.hoisted(() => vi.fn());
const useRolesMock = vi.hoisted(() => vi.fn());
const useUserProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries", () => ({
  useMembers: useMembersMock,
  useRoles: useRolesMock,
  useUserProfile: useUserProfileMock,
}));

describe("ProfilePopout", () => {
  beforeEach(() => {
    useGuildStore.setState({
      activeServerId: "2001",
      activeChannelId: null,
      lastChannelPerServer: {},
      collapsedCategories: {},
      collapsedFolders: new Set(),
    });
    useUIStore.setState({
      profilePopout: { userId: "1003", position: { x: 120, y: 80 } },
      contextMenu: null,
      activeModal: null,
      modalProps: {},
    });
    useUserProfileMock.mockReturnValue({
      data: {
        id: "1003",
        username: "Carol",
        displayName: "Carol",
        avatar: null,
        status: "offline",
        customStatus: "Reviewing",
        bot: false,
        banner: null,
        bio: "Reviewing",
        accentColor: null,
        badges: [],
        createdAt: "2026-03-03T00:00:00Z",
      },
    });
    useMembersMock.mockReturnValue({
      data: [
        {
          user: {
            id: "1003",
            username: "Carol",
            displayName: "Carol",
            avatar: null,
            status: "offline",
            customStatus: "Reviewing",
            bot: false,
          },
          nick: null,
          roles: ["member"],
          joinedAt: "2026-03-03T00:00:00Z",
          avatar: null,
        },
      ],
    });
    useRolesMock.mockReturnValue({
      data: [
        {
          id: "member",
          name: "Member",
          color: "#99aab5",
          position: 100,
          permissions: 0,
          mentionable: false,
          hoist: false,
          memberCount: 1,
        },
      ],
    });
  });

  test("renders role pills from fetched member and role queries", () => {
    render(<ProfilePopout />);

    expect(screen.getByRole("dialog", { name: "User Profile" })).toBeTruthy();
    expect(screen.getAllByText("Carol").length).toBeGreaterThan(0);
    expect(screen.getByText("Member")).toBeTruthy();
    expect(screen.getByText("Reviewing")).toBeTruthy();
  });
});
