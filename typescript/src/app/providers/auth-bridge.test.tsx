// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, waitFor } from "@/test/test-utils";
import { useAuthStore } from "@/shared/model/stores/auth-store";

const useAuthSessionMock = vi.hoisted(() => vi.fn());
const useMyProfileMock = vi.hoisted(() => vi.fn());
const useStorageObjectUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/entities/auth", () => ({
  useAuthSession: useAuthSessionMock,
}));

vi.mock("@/shared/api/queries", () => ({
  useMyProfile: useMyProfileMock,
  useStorageObjectUrl: useStorageObjectUrlMock,
}));

import { AuthBridge } from "./auth-bridge";

describe("AuthBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStorageObjectUrlMock.mockReturnValue({ data: undefined });
    useAuthStore.setState({
      currentUser: null,
      currentPrincipalId: null,
      status: "online",
      customStatus: null,
    });
  });

  test("hydrates auth-store with my profile after authentication", async () => {
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "alice@example.com",
        emailVerified: true,
      },
      getIdToken: () => Promise.resolve("token-1"),
    });
    useMyProfileMock.mockReturnValue({
      data: {
        displayName: "Alice Cooper",
        statusText: "Ready to ship",
        avatarKey: "avatars/alice.png",
        bannerKey: "banners/alice.png",
      },
    });
    useStorageObjectUrlMock.mockReturnValue({
      data: "https://cdn.example/alice.png",
    });

    render(<AuthBridge />);

    await waitFor(() => {
      expect(useAuthStore.getState().currentUser).toMatchObject({
        id: "uid-1",
        username: "alice",
        displayName: "Alice Cooper",
        customStatus: "Ready to ship",
        avatar: "https://cdn.example/alice.png",
      });
      expect(useAuthStore.getState().customStatus).toBe("Ready to ship");
    });
  });

  test("keeps session-derived fallback when profile fetch is unavailable", async () => {
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: {
        uid: "u-2",
        email: "fallback@example.com",
        emailVerified: true,
      },
      getIdToken: () => Promise.resolve("token-1"),
    });
    useMyProfileMock.mockReturnValue({
      data: undefined,
    });

    render(<AuthBridge />);

    await waitFor(() => {
      expect(useAuthStore.getState().currentUser).toMatchObject({
        id: "u-2",
        username: "fallback",
        displayName: "fallback",
        customStatus: null,
        avatar: null,
      });
    });
  });

  test("未認証セッションへ遷移したら auth-store の currentUser をクリアする", async () => {
    useAuthStore.setState({
      currentUser: {
        id: "uid-old",
        username: "old-user",
        displayName: "old-user",
        avatar: "avatars/old.png",
        status: "online",
        customStatus: "old-status",
        bot: false,
      },
      currentPrincipalId: null,
      status: "online",
      customStatus: "old-status",
    });
    useAuthSessionMock.mockReturnValue({
      status: "unauthenticated",
      user: null,
      getIdToken: () => Promise.resolve(null),
    });
    useMyProfileMock.mockReturnValue({
      data: undefined,
    });

    render(<AuthBridge />);

    await waitFor(() => {
      expect(useAuthStore.getState().currentUser).toBeNull();
      expect(useAuthStore.getState().customStatus).toBeNull();
    });
  });
});
