// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { useGuildStore } from "@/shared/model/stores/guild-store";
import { ProfileModal } from "./profile-modal";

const useMembersMock = vi.hoisted(() => vi.fn());
const useRolesMock = vi.hoisted(() => vi.fn());
const useUserProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/queries", () => ({
  useMembers: useMembersMock,
  useRoles: useRolesMock,
  useUserProfile: useUserProfileMock,
}));

describe("ProfileModal", () => {
  beforeEach(() => {
    useGuildStore.setState({
      activeServerId: "2001",
      activeChannelId: null,
      lastChannelPerServer: {},
      collapsedCategories: {},
      collapsedFolders: new Set(),
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

  test("renders fetched roles in the profile section", () => {
    render(<ProfileModal userId="1003" onClose={() => {}} />);

    expect(screen.getAllByText("Carol").length).toBeGreaterThan(0);
    expect(screen.getByText("Member")).toBeTruthy();
    expect(screen.getByText("Reviewing")).toBeTruthy();
  });
});
