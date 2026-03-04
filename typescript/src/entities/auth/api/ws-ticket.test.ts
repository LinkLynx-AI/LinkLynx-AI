import { afterEach, describe, expect, test, vi } from "vitest";
import type { AuthenticatedFetchResult } from "../model";

const authenticatedFetchMock = vi.hoisted(() => vi.fn<() => Promise<AuthenticatedFetchResult>>());

vi.mock("./authenticated-fetch", () => ({
  authenticatedFetch: authenticatedFetchMock,
}));

import { issueWsTicket } from "./ws-ticket";

describe("issueWsTicket", () => {
  afterEach(() => {
    authenticatedFetchMock.mockReset();
  });

  test("正常レスポンスで ticket と expiresAt を返す", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      response: new Response(
        JSON.stringify({
          ticket: "ticket-1",
          expiresAt: "2026-03-04T00:00:00Z",
        }),
        { status: 200 },
      ),
    });

    const result = await issueWsTicket();

    expect(result).toEqual({
      ok: true,
      data: {
        ticket: "ticket-1",
        expiresAt: "2026-03-04T00:00:00Z",
      },
    });
    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/auth/ws-ticket",
      {
        method: "POST",
      },
      {},
    );
  });

  test("API base URL に path がある場合も /auth/ws-ticket を連結する", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/v1";
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      response: new Response(
        JSON.stringify({
          ticket: "ticket-2",
          expiresAt: "2026-03-04T00:00:00Z",
        }),
        { status: 200 },
      ),
    });

    const result = await issueWsTicket();

    expect(result.ok).toBe(true);
    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/auth/ws-ticket",
      {
        method: "POST",
      },
      {},
    );
  });

  test("認証失敗は unauthenticated を返す", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    authenticatedFetchMock.mockResolvedValue({
      ok: false,
      error: {
        code: "unauthenticated",
        message: "missing user",
      },
    });

    const result = await issueWsTicket();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("unauthenticated");
  });

  test("AUTH_UNAVAILABLE は temporarily-unavailable へ変換する", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      response: new Response(
        JSON.stringify({
          code: "AUTH_UNAVAILABLE",
          message: "dependency unavailable",
          request_id: "req-1",
        }),
        { status: 503 },
      ),
    });

    const result = await issueWsTicket();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("temporarily-unavailable");
    expect(result.error.backendCode).toBe("AUTH_UNAVAILABLE");
    expect(result.error.requestId).toBe("req-1");
    expect(result.error.status).toBe(503);
  });

  test("AUTH_PRINCIPAL_NOT_MAPPED は forbidden へ変換する", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      response: new Response(
        JSON.stringify({
          code: "AUTH_PRINCIPAL_NOT_MAPPED",
          message: "principal mapping missing",
          request_id: "req-2",
        }),
        { status: 403 },
      ),
    });

    const result = await issueWsTicket();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("forbidden");
    expect(result.error.backendCode).toBe("AUTH_PRINCIPAL_NOT_MAPPED");
    expect(result.error.requestId).toBe("req-2");
    expect(result.error.status).toBe(403);
  });

  test("network-request-failed は temporarily-unavailable へ変換する", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    authenticatedFetchMock.mockResolvedValue({
      ok: false,
      error: {
        code: "network-request-failed",
        message: "network down",
      },
    });

    const result = await issueWsTicket();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("temporarily-unavailable");
    expect(result.error.message).toBe("network down");
  });

  test("成功レスポンス形式不正は unexpected-response を返す", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    authenticatedFetchMock.mockResolvedValue({
      ok: true,
      response: new Response(
        JSON.stringify({
          ticket: "",
          expiresAt: "2026-03-04T00:00:00Z",
        }),
        { status: 200 },
      ),
    });

    const result = await issueWsTicket();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("unexpected-response");
  });

  test("NEXT_PUBLIC_API_URL が未設定なら unknown を返す", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    const result = await issueWsTicket();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error result");
    }

    expect(result.error.code).toBe("unknown");
    expect(result.error.message).toContain("NEXT_PUBLIC_API_URL is required");
  });
});
