// @vitest-environment jsdom
import type { AuthSessionContextValue, PrincipalProvisionResult } from "@/entities";
import { render, screen, waitFor } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const useAuthSessionMock = vi.hoisted(() =>
  vi.fn<() => AuthSessionContextValue>(() => ({
    status: "authenticated",
    user: {
      uid: "uid-1",
      email: "user@example.com",
      emailVerified: true,
    },
    getIdToken: () => Promise.resolve("token-1"),
  })),
);
const ensurePrincipalProvisionedForCurrentUserMock = vi.hoisted(() =>
  vi.fn<() => Promise<PrincipalProvisionResult>>(() =>
    Promise.resolve({
      ok: true,
      data: {
        principalId: "1001",
        firebaseUid: "uid-1",
        requestId: "req-1",
      },
    }),
  ),
);
const locationReplaceMock = vi.hoisted(() => vi.fn());

vi.mock("@/entities", () => ({
  ensurePrincipalProvisionedForCurrentUser: ensurePrincipalProvisionedForCurrentUserMock,
  useAuthSession: useAuthSessionMock,
}));

import { ProtectedPreviewGate } from "./protected-preview-gate";

describe("ProtectedPreviewGate browser behavior", () => {
  beforeEach(() => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      replace: locationReplaceMock,
      pathname: "/channels/me",
      search: "?tab=all",
    } as unknown as Location);
    locationReplaceMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  test("token-unavailable は session-expired 理由でログインへリダイレクトする", async () => {
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "user@example.com",
        emailVerified: true,
      },
      getIdToken: () => Promise.resolve("token-1"),
    });
    ensurePrincipalProvisionedForCurrentUserMock.mockResolvedValue({
      ok: false,
      error: {
        code: "token-unavailable",
        message: "token unavailable",
        backendCode: null,
        requestId: null,
        status: null,
      },
    });

    render(
      <ProtectedPreviewGate guard={null}>
        <p>protected content</p>
      </ProtectedPreviewGate>,
    );

    await waitFor(() => {
      expect(screen.getByText("ログインが必要です")).toBeTruthy();
    });
    await waitFor(() => {
      expect(locationReplaceMock).toHaveBeenCalledTimes(1);
    });
    const firstCall = locationReplaceMock.mock.calls[0];
    expect(firstCall?.[0]).toContain("reason=session-expired");
    expect(firstCall?.[0]).toContain("returnTo=%2Fchannels%2Fme%3Ftab%3Dall");
  });

  test("403 は forbidden ガード画面を表示し、ログインリダイレクトしない", async () => {
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "user@example.com",
        emailVerified: true,
      },
      getIdToken: () => Promise.resolve("token-1"),
    });
    ensurePrincipalProvisionedForCurrentUserMock.mockResolvedValue({
      ok: false,
      error: {
        code: "principal-not-mapped",
        message: "forbidden",
        backendCode: "AUTH_PRINCIPAL_NOT_MAPPED",
        requestId: "req-403",
        status: 403,
      },
    });

    render(
      <ProtectedPreviewGate guard={null}>
        <p>protected content</p>
      </ProtectedPreviewGate>,
    );

    await waitFor(() => {
      expect(screen.getByText("アクセス権限がありません")).toBeTruthy();
    });
    expect(locationReplaceMock).not.toHaveBeenCalled();
  });
});
