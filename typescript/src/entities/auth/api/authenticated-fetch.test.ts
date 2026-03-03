import { afterEach, describe, expect, test, vi } from "vitest";

const getFirebaseAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib", () => ({
  getFirebaseAuth: getFirebaseAuthMock,
}));

import { authenticatedFetch } from "./authenticated-fetch";

type MockCurrentUser = {
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

function setCurrentUser(user: MockCurrentUser | null): void {
  getFirebaseAuthMock.mockReturnValue({
    currentUser: user,
  });
}

describe("authenticatedFetch", () => {
  afterEach(() => {
    getFirebaseAuthMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("currentUser が無い場合は unauthenticated を返す", async () => {
    setCurrentUser(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await authenticatedFetch("http://localhost:8080/protected/ping");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("unauthenticated");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Bearer を付与して fetch を実行する", async () => {
    setCurrentUser({
      getIdToken: () => Promise.resolve("token-1"),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await authenticatedFetch("http://localhost:8080/protected/ping", {
      method: "GET",
      headers: {
        "x-client-id": "ui",
      },
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/protected/ping", {
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
    expect(headers.get("x-client-id")).toBe("ui");
  });

  test("IDトークン取得失敗時は token-unavailable を返す", async () => {
    setCurrentUser({
      getIdToken: () => Promise.reject(new Error("token unavailable")),
    });

    const result = await authenticatedFetch("http://localhost:8080/protected/ping");
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("token-unavailable");
  });

  test("fetch 失敗時は network-request-failed を返す", async () => {
    setCurrentUser({
      getIdToken: () => Promise.resolve("token-2"),
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await authenticatedFetch("http://localhost:8080/protected/ping");
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("network-request-failed");
  });
});
