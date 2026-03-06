// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AuthSessionContextValue } from "@/entities/auth";
import { render, waitFor } from "@/test/test-utils";
import { useAuthStore } from "@/shared/model/stores/auth-store";

const useAuthSessionMock = vi.hoisted(() =>
  vi.fn<() => AuthSessionContextValue>(() => ({
    status: "unauthenticated",
    user: null,
    getIdToken: () => Promise.resolve(null),
  })),
);
const useMyProfileMock = vi.hoisted(() =>
  vi.fn<
    (userId: string | null) => {
      data:
        | {
            displayName: string;
            statusText: string | null;
            avatarKey: string | null;
            bannerKey: string | null;
          }
        | undefined;
    }
  >(),
);
const useStorageObjectUrlMock = vi.hoisted(() =>
  vi.fn<(objectKey: string | null) => { data: string | undefined }>(),
);

vi.mock("@/entities/auth", () => ({
  useAuthSession: useAuthSessionMock,
}));

vi.mock("@/shared/api/queries", () => ({
  useMyProfile: useMyProfileMock,
  useStorageObjectUrl: useStorageObjectUrlMock,
}));

import { ProfileBridge } from "./profile-bridge";

describe("ProfileBridge", () => {
  afterEach(() => {
    useAuthStore.setState({
      currentUser: null,
      status: "online",
      customStatus: null,
    });
    vi.clearAllMocks();
  });

  test("hydrates auth-store with saved profile and avatar url", async () => {
    useAuthStore.setState({
      currentUser: {
        id: "u-1",
        username: "alice",
        displayName: "alice",
        avatar: null,
        status: "online",
        customStatus: null,
        bot: false,
      },
      status: "online",
      customStatus: null,
    });
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
        displayName: "Alice",
        statusText: "busy coding",
        avatarKey: "profiles/u-1/avatar/alice.png",
        bannerKey: "profiles/u-1/banner/alice.png",
      },
    });
    useStorageObjectUrlMock.mockReturnValue({
      data: "https://storage.example/avatar.png",
    });

    render(<ProfileBridge />);

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.currentUser).toMatchObject({
        id: "u-1",
        username: "alice",
        displayName: "Alice",
        avatar: "https://storage.example/avatar.png",
        customStatus: "busy coding",
      });
      expect(state.customStatus).toBe("busy coding");
    });
  });
});
