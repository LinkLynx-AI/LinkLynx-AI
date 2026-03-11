// @vitest-environment jsdom
import type { AuthSessionContextValue } from "@/entities/auth";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, waitFor } from "@/test/test-utils";
import { useAuthStore } from "@/shared/model/stores/auth-store";

const useAuthSessionMock = vi.hoisted(() =>
  vi.fn<() => AuthSessionContextValue>(() => ({
    status: "unauthenticated",
    user: null,
    getIdToken: () => Promise.resolve(null),
  })),
);
const useMyProfileMock = vi.hoisted(() => vi.fn());
const useMyProfileMediaDownloadUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/entities/auth", () => ({
  useAuthSession: useAuthSessionMock,
}));

vi.mock("@/shared/api/queries", () => ({
  useMyProfile: useMyProfileMock,
  useMyProfileMediaDownloadUrl: useMyProfileMediaDownloadUrlMock,
}));

import { AuthBridge } from "./auth-bridge";

describe("AuthBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMyProfileMediaDownloadUrlMock.mockReturnValue({ data: undefined });
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
        uid: "u-1",
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
        theme: "dark",
      },
    });
    useMyProfileMediaDownloadUrlMock.mockReturnValue({
      data: "https://cdn.example/alice.png",
    });

    render(<AuthBridge />);

    await waitFor(() => {
      expect(useAuthStore.getState().currentUser).toMatchObject({
        id: "u-1",
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
      getIdToken: () => Promise.resolve("token-2"),
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

  test("waits for avatar download URL when avatarKey exists", async () => {
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: {
        uid: "u-1",
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
        bannerKey: null,
        theme: "dark",
      },
    });
    useMyProfileMediaDownloadUrlMock.mockReturnValue({ data: undefined });

    render(<AuthBridge />);

    await waitFor(() => {
      expect(useAuthStore.getState().currentUser).toMatchObject({
        id: "u-1",
        username: "alice",
        displayName: "alice",
        avatar: null,
      });
    });
  });

  test("clears stale auth-store state when session becomes unauthenticated", async () => {
    useAuthStore.setState({
      currentUser: {
        id: "u-stale",
        username: "stale",
        displayName: "Stale",
        avatar: null,
        status: "online",
        customStatus: "stale-status",
        bot: false,
      },
      currentPrincipalId: null,
      status: "online",
      customStatus: "stale-status",
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
