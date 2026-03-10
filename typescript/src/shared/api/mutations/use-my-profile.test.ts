// @vitest-environment jsdom
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@/test/test-utils";
import type { Relationship } from "@/shared/api/api-client";
import type { GuildMember } from "@/shared/model/types/server";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { useUpdateMyProfile } from "./use-my-profile";

const mockUpdateMyProfile = vi.fn();

vi.mock("@/shared/api/api-client", () => ({
  getAPIClient: () => ({
    updateMyProfile: mockUpdateMyProfile,
  }),
}));

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useUpdateMyProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      currentUser: {
        id: "u-1",
        username: "alice",
        displayName: "Old Name",
        avatar: null,
        status: "online",
        customStatus: "old-status",
        bot: false,
      },
      currentPrincipalId: null,
      status: "online",
      customStatus: "old-status",
    });
  });

  test("syncs my profile into auth-store and relevant query caches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = createWrapper(queryClient);
    const friends: Relationship[] = [
      {
        id: "r-1",
        type: 1,
        user: {
          id: "u-1",
          username: "alice",
          displayName: "Old Name",
          avatar: null,
          status: "online",
          customStatus: "old-status",
          bot: false,
        },
      },
    ];
    const members: GuildMember[] = [
      {
        user: {
          id: "u-1",
          username: "alice",
          displayName: "Old Name",
          avatar: null,
          status: "online",
          customStatus: "old-status",
          bot: false,
        },
        nick: null,
        roles: [],
        joinedAt: "2026-03-08T00:00:00Z",
        avatar: null,
      },
    ];
    queryClient.setQueryData(["friends"], friends);
    queryClient.setQueryData(["members", "guild-1"], members);

    mockUpdateMyProfile.mockResolvedValue({
      displayName: "New Name",
      statusText: "new-status",
      avatarKey: "avatars/new-name.png",
      bannerKey: "banners/new-name.png",
    });

    const { result } = renderHook(() => useUpdateMyProfile("u-1"), { wrapper });

    result.current.mutate({
      displayName: "New Name",
      statusText: "new-status",
      avatarKey: "avatars/new-name.png",
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockUpdateMyProfile).toHaveBeenCalledWith({
      displayName: "New Name",
      statusText: "new-status",
      avatarKey: "avatars/new-name.png",
    });
    expect(queryClient.getQueryData(["myProfile", "u-1"])).toEqual({
      displayName: "New Name",
      statusText: "new-status",
      avatarKey: "avatars/new-name.png",
      bannerKey: "banners/new-name.png",
    });
    expect(queryClient.getQueryData(["friends"])).toEqual([
      {
        id: "r-1",
        type: 1,
        user: {
          id: "u-1",
          username: "alice",
          displayName: "New Name",
          avatar: null,
          status: "online",
          customStatus: "new-status",
          bot: false,
        },
      },
    ]);
    expect(queryClient.getQueryData(["members", "guild-1"])).toEqual([
      {
        user: {
          id: "u-1",
          username: "alice",
          displayName: "New Name",
          avatar: null,
          status: "online",
          customStatus: "new-status",
          bot: false,
        },
        nick: null,
        roles: [],
        joinedAt: "2026-03-08T00:00:00Z",
        avatar: null,
      },
    ]);
    expect(useAuthStore.getState().currentUser).toMatchObject({
      displayName: "New Name",
      customStatus: "new-status",
      avatar: null,
    });
    expect(useAuthStore.getState().customStatus).toBe("new-status");
  });
});
