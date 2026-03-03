// @vitest-environment jsdom
import type { AuthSessionContextValue } from "@/entities/auth";
import { render, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useAuthStore } from "@/shared/model/stores/auth-store";

const useAuthSessionMock = vi.hoisted(() =>
  vi.fn<() => AuthSessionContextValue>(() => ({
    status: "unauthenticated",
    user: null,
    getIdToken: () => Promise.resolve(null),
  })),
);

vi.mock("@/entities/auth", () => ({
  useAuthSession: useAuthSessionMock,
}));

import { AuthBridge } from "./auth-bridge";

describe("AuthBridge", () => {
  afterEach(() => {
    useAuthStore.setState({
      currentUser: null,
      status: "online",
      customStatus: null,
    });
    vi.clearAllMocks();
  });

  test("認証済みセッションを auth-store へ同期する", async () => {
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "alice@example.com",
        emailVerified: true,
      },
      getIdToken: () => Promise.resolve("token-1"),
    });

    render(<AuthBridge />);

    await waitFor(() => {
      const currentUser = useAuthStore.getState().currentUser;
      expect(currentUser?.id).toBe("uid-1");
      expect(currentUser?.username).toBe("alice");
    });
  });

  test("未認証セッションへ遷移したら auth-store の currentUser をクリアする", async () => {
    useAuthStore.setState({
      currentUser: {
        id: "uid-old",
        username: "old-user",
        displayName: "old-user",
        avatar: null,
        status: "online",
        customStatus: null,
        bot: false,
      },
      status: "online",
      customStatus: null,
    });
    useAuthSessionMock.mockReturnValue({
      status: "unauthenticated",
      user: null,
      getIdToken: () => Promise.resolve(null),
    });

    render(<AuthBridge />);

    await waitFor(() => {
      expect(useAuthStore.getState().currentUser).toBeNull();
    });
  });

  test("認証状態でも user が null の場合は auth-store の currentUser をクリアする", async () => {
    useAuthStore.setState({
      currentUser: {
        id: "uid-old",
        username: "old-user",
        displayName: "old-user",
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
      user: null,
      getIdToken: () => Promise.resolve("token-1"),
    });

    render(<AuthBridge />);

    await waitFor(() => {
      expect(useAuthStore.getState().currentUser).toBeNull();
    });
  });
});
