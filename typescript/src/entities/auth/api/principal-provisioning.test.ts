import { afterEach, describe, expect, test, vi } from "vitest";

const getFirebaseAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib", () => ({
  getFirebaseAuth: getFirebaseAuthMock,
}));

import { ensurePrincipalProvisionedForCurrentUser } from "./principal-provisioning";

type MockCurrentUser = {
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

function setCurrentUser(user: MockCurrentUser | null): void {
  getFirebaseAuthMock.mockReturnValue({
    currentUser: user,
  });
}

describe("ensurePrincipalProvisionedForCurrentUser", () => {
  afterEach(() => {
    getFirebaseAuthMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("principal確保に成功したら principal_id と request_id を返す", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    setCurrentUser({
      getIdToken: () => Promise.resolve("token-1"),
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          request_id: "req-1",
          principal_id: 1001,
          firebase_uid: "uid-1",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensurePrincipalProvisionedForCurrentUser();
    expect(result).toEqual({
      ok: true,
      data: {
        principalId: 1001,
        firebaseUid: "uid-1",
        requestId: "req-1",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/v1/protected/ping", {
      method: "GET",
      headers: expect.any(Headers),
    });

    const firstCall = fetchMock.mock.calls[0];
    if (firstCall === undefined) {
      throw new Error("expected fetch to be called");
    }
    const requestInit = firstCall[1] as RequestInit;
    const headers = requestInit.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  test("currentUser が無い場合は unauthenticated を返す", async () => {
    setCurrentUser(null);
    const result = await ensurePrincipalProvisionedForCurrentUser();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("unauthenticated");
  });

  test("AUTH_EMAIL_NOT_VERIFIED を email-not-verified へ変換する", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    setCurrentUser({
      getIdToken: () => Promise.resolve("token-2"),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "AUTH_EMAIL_NOT_VERIFIED",
            message: "email verification is required",
            request_id: "req-2",
          }),
          { status: 403 },
        ),
      ),
    );

    const result = await ensurePrincipalProvisionedForCurrentUser();
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("email-not-verified");
    expect(result.error.requestId).toBe("req-2");
    expect(result.error.backendCode).toBe("AUTH_EMAIL_NOT_VERIFIED");
  });

  test("AUTH_UNAVAILABLE を auth-unavailable へ変換する", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    setCurrentUser({
      getIdToken: () => Promise.resolve("token-3"),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "AUTH_UNAVAILABLE",
            message: "authentication dependency is unavailable",
            request_id: "req-3",
          }),
          { status: 503 },
        ),
      ),
    );

    const result = await ensurePrincipalProvisionedForCurrentUser();
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("auth-unavailable");
    expect(result.error.status).toBe(503);
  });

  test("fetch 失敗時は network-request-failed を返す", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    setCurrentUser({
      getIdToken: () => Promise.resolve("token-4"),
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await ensurePrincipalProvisionedForCurrentUser();
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("network-request-failed");
  });

  test("成功レスポンスの形式不正は unexpected-response を返す", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    setCurrentUser({
      getIdToken: () => Promise.resolve("token-5"),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            request_id: "req-5",
            principal_id: "not-number",
            firebase_uid: "uid-5",
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await ensurePrincipalProvisionedForCurrentUser();
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("unexpected-response");
  });

  test("NEXT_PUBLIC_API_URL 未設定時は unknown を返す", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    setCurrentUser({
      getIdToken: () => Promise.resolve("token-6"),
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensurePrincipalProvisionedForCurrentUser();
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("unknown");
    expect(result.error.message).toContain("NEXT_PUBLIC_API_URL is required but not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
