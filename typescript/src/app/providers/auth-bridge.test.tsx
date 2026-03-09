// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, waitFor } from "@/test/test-utils";
import { useAuthStore } from "@/shared/model/stores/auth-store";

const useAuthSessionMock = vi.hoisted(() => vi.fn());
const useMyProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/entities/auth", () => ({
  useAuthSession: useAuthSessionMock,
}));

vi.mock("@/shared/api/queries", () => ({
  useMyProfile: useMyProfileMock,
}));

import { AuthBridge } from "./auth-bridge";

describe("AuthBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      currentUser: null,
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
    });
    useMyProfileMock.mockReturnValue({
      data: {
        displayName: "Alice Cooper",
        statusText: "Ready to ship",
        avatarKey: null,
      },
    });

    render(<AuthBridge />);

    await waitFor(() => {
      expect(useAuthStore.getState().currentUser).toMatchObject({
        id: "u-1",
        username: "alice",
        displayName: "Alice Cooper",
        customStatus: "Ready to ship",
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
      status: "online",
      customStatus: "stale-status",
    });
    useAuthSessionMock.mockReturnValue({
      status: "unauthenticated",
      user: null,
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
