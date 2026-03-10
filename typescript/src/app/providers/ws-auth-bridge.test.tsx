// @vitest-environment jsdom
import type { InfiniteData } from "@tanstack/react-query";
import type {
  AuthSessionContextValue,
  AuthActionResult,
  WsTicketIssueResult,
} from "@/entities/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as baseRender } from "@testing-library/react";
import { createElement, type ReactElement } from "react";
import type { MessagePage } from "@/shared/api/api-client";
import { buildMessagesQueryKey } from "@/shared/api/message-query";
import { act, fireEvent, render, screen, waitFor } from "@/test/test-utils";
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
const issueWsTicketMock = vi.hoisted(() =>
  vi.fn<() => Promise<WsTicketIssueResult>>(() =>
    Promise.resolve({
      ok: true,
      data: {
        ticket: "ticket-1",
        expiresAt: "2026-03-04T00:00:00Z",
      },
    }),
  ),
);
const signOutCurrentUserMock = vi.hoisted(() =>
  vi.fn<() => Promise<AuthActionResult<null>>>(() => Promise.resolve({ ok: true, data: null })),
);
const usePathnameMock = vi.hoisted(() => vi.fn(() => "/channels/me"));
const locationReplaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/entities/auth", async () => {
  const actual = await vi.importActual<typeof import("@/entities/auth")>("@/entities/auth");
  return {
    ...actual,
    useAuthSession: useAuthSessionMock,
    issueWsTicket: issueWsTicketMock,
    signOutCurrentUser: signOutCurrentUserMock,
  };
});

import { WsAuthBridge } from "./ws-auth-bridge";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  send = vi.fn<(data: string) => void>();
  close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED;
  });

  constructor(url: string | URL) {
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  emitOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  emitJsonMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  emitClose(code: number, reason = "", wasClean = true): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean } as CloseEvent);
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function renderWithQueryClient(ui: ReactElement, queryClient: QueryClient) {
  return baseRender(
    createElement(QueryClientProvider, {
      client: queryClient,
      children: ui,
    }),
  );
}

describe("WsAuthBridge", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

    vi.spyOn(window, "location", "get").mockReturnValue({
      replace: locationReplaceMock,
      pathname: "/channels/me",
      search: "?tab=all",
    } as unknown as Location);

    locationReplaceMock.mockReset();
    issueWsTicketMock.mockReset();
    issueWsTicketMock.mockResolvedValue({
      ok: true,
      data: {
        ticket: "ticket-1",
        expiresAt: "2026-03-04T00:00:00Z",
      },
    });
    signOutCurrentUserMock.mockReset();
    signOutCurrentUserMock.mockResolvedValue({ ok: true, data: null });
    useAuthSessionMock.mockReset();
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "user@example.com",
        emailVerified: true,
      },
      getIdToken: () => Promise.resolve("token-1"),
    });
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue("/channels/me");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("ticket取得後に /ws へ接続して auth.identify を送信する", async () => {
    render(<WsAuthBridge />);

    await waitFor(() => {
      expect(FakeWebSocket.instances.length).toBe(1);
    });

    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) {
      throw new Error("socket should exist");
    }

    expect(socket.url).toBe("ws://localhost:8080/ws");

    act(() => {
      socket.emitOpen();
    });

    await waitFor(() => {
      expect(socket.send).toHaveBeenCalledTimes(1);
    });

    const firstCall = socket.send.mock.calls[0];
    if (firstCall === undefined) {
      throw new Error("identify message should be sent");
    }

    expect(JSON.parse(firstCall[0])).toEqual({
      type: "auth.identify",
      d: {
        method: "ticket",
        ticket: "ticket-1",
      },
    });
  });

  test("auth.reauthenticate 受信時に最新IDトークンを返信する", async () => {
    const getIdTokenMock = vi.fn(() => Promise.resolve("token-refreshed"));
    useAuthSessionMock.mockReturnValue({
      status: "authenticated",
      user: {
        uid: "uid-1",
        email: "user@example.com",
        emailVerified: true,
      },
      getIdToken: getIdTokenMock,
    });

    render(<WsAuthBridge />);

    await waitFor(() => {
      expect(FakeWebSocket.instances.length).toBe(1);
    });

    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) {
      throw new Error("socket should exist");
    }

    act(() => {
      socket.emitOpen();
      socket.emitJsonMessage({
        type: "auth.reauthenticate",
        deadline_epoch: 10,
        request_id: "req-1",
      });
    });

    await waitFor(() => {
      expect(getIdTokenMock).toHaveBeenCalledWith(true);
      expect(socket.send).toHaveBeenCalledTimes(2);
    });

    const secondCall = socket.send.mock.calls[1];
    if (secondCall === undefined) {
      throw new Error("reauth message should be sent");
    }

    expect(JSON.parse(secondCall[0])).toEqual({
      type: "auth.reauthenticate",
      d: {
        idToken: "token-refreshed",
      },
    });
  });

  test("1008 close を受けると signOut して login へ遷移する", async () => {
    render(<WsAuthBridge />);

    await waitFor(() => {
      expect(FakeWebSocket.instances.length).toBe(1);
    });

    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) {
      throw new Error("socket should exist");
    }

    act(() => {
      socket.emitClose(1008, "identify_required");
    });

    await waitFor(() => {
      expect(signOutCurrentUserMock).toHaveBeenCalledTimes(1);
      expect(locationReplaceMock).toHaveBeenCalledTimes(1);
    });

    const firstCall = locationReplaceMock.mock.calls[0];
    expect(firstCall?.[0]).toContain("reason=session-expired");
    expect(firstCall?.[0]).toContain("returnTo=%2Fchannels%2Fme%3Ftab%3Dall");
  });

  test("ws-ticket が forbidden のときは再試行せず login へ遷移する", async () => {
    issueWsTicketMock.mockResolvedValue({
      ok: false,
      error: {
        code: "forbidden",
        message: "principal mapping missing",
        backendCode: "AUTH_PRINCIPAL_NOT_MAPPED",
        requestId: "req-1",
        status: 403,
      },
    });

    render(<WsAuthBridge />);

    await waitFor(() => {
      expect(issueWsTicketMock).toHaveBeenCalledTimes(1);
      expect(signOutCurrentUserMock).toHaveBeenCalledTimes(1);
      expect(locationReplaceMock).toHaveBeenCalledTimes(1);
    });

    expect(FakeWebSocket.instances.length).toBe(0);
    const firstCall = locationReplaceMock.mock.calls[0];
    expect(firstCall?.[0]).toContain("reason=session-expired");
  });

  test("NEXT_PUBLIC_API_URL に userinfo が含まれる場合は接続せず再試行バナーを表示する", async () => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_API_URL = "https://user:pass@localhost:8080";

    render(<WsAuthBridge />);

    await act(async () => {
      await flushMicrotasks();
    });

    expect(issueWsTicketMock).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances.length).toBe(0);
    expect(screen.getByText(/認証基盤が一時的に利用できません/)).toBeTruthy();
  });

  test("1011 close でバナー表示し、指数バックオフで再接続する", async () => {
    vi.useFakeTimers();

    render(<WsAuthBridge />);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(FakeWebSocket.instances.length).toBe(1);

    const socket1 = FakeWebSocket.instances[0];
    if (socket1 === undefined) {
      throw new Error("socket1 should exist");
    }

    act(() => {
      socket1.emitClose(1011, "AUTH_UNAVAILABLE");
    });

    expect(screen.getByText(/認証基盤が一時的に利用できません/)).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(999);
      await flushMicrotasks();
    });
    expect(issueWsTicketMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushMicrotasks();
    });
    expect(issueWsTicketMock).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances.length).toBe(2);

    const socket2 = FakeWebSocket.instances[1];
    if (socket2 === undefined) {
      throw new Error("socket2 should exist");
    }

    act(() => {
      socket2.emitClose(1011, "AUTH_UNAVAILABLE");
    });

    await act(async () => {
      vi.advanceTimersByTime(1_999);
      await flushMicrotasks();
    });
    expect(issueWsTicketMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushMicrotasks();
    });
    expect(issueWsTicketMock).toHaveBeenCalledTimes(3);
  });

  test("1011 バナーの今すぐ再試行で即時に再接続する", async () => {
    vi.useFakeTimers();

    render(<WsAuthBridge />);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(FakeWebSocket.instances.length).toBe(1);

    const socket1 = FakeWebSocket.instances[0];
    if (socket1 === undefined) {
      throw new Error("socket1 should exist");
    }

    act(() => {
      socket1.emitClose(1011, "AUTH_UNAVAILABLE");
    });

    expect(screen.getByRole("button", { name: "今すぐ再試行" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "今すぐ再試行" }));
      await flushMicrotasks();
    });

    expect(issueWsTicketMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await flushMicrotasks();
    });
    expect(issueWsTicketMock).toHaveBeenCalledTimes(2);
  });

  test("再試行ボタンを連打しても connect は単一フライトで実行される", async () => {
    vi.useFakeTimers();

    render(<WsAuthBridge />);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(FakeWebSocket.instances.length).toBe(1);

    const socket1 = FakeWebSocket.instances[0];
    if (socket1 === undefined) {
      throw new Error("socket1 should exist");
    }

    act(() => {
      socket1.emitClose(1011, "AUTH_UNAVAILABLE");
    });

    let resolveDeferredTicket: ((value: WsTicketIssueResult) => void) | null = null;
    issueWsTicketMock.mockImplementationOnce(
      () =>
        new Promise<WsTicketIssueResult>((resolve) => {
          resolveDeferredTicket = resolve;
        }),
    );

    await act(async () => {
      const retryButton = screen.getByRole("button", { name: "今すぐ再試行" });
      fireEvent.click(retryButton);
      fireEvent.click(retryButton);
      await flushMicrotasks();
    });

    expect(issueWsTicketMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveDeferredTicket?.({
        ok: true,
        data: {
          ticket: "ticket-2",
          expiresAt: "2026-03-04T00:00:00Z",
        },
      });
      await flushMicrotasks();
    });

    expect(FakeWebSocket.instances.length).toBe(2);
  });

  test("auth.ready 後に active guild channel を購読する", async () => {
    usePathnameMock.mockReturnValue("/channels/10/20");

    render(<WsAuthBridge />);

    await waitFor(() => {
      expect(FakeWebSocket.instances.length).toBe(1);
    });

    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) {
      throw new Error("socket should exist");
    }

    act(() => {
      socket.emitOpen();
      socket.emitJsonMessage({ type: "auth.ready" });
    });

    await waitFor(() => {
      expect(socket.send).toHaveBeenCalledTimes(2);
    });

    expect(JSON.parse(String(socket.send.mock.calls[1]?.[0]))).toEqual({
      type: "message.subscribe",
      d: {
        guild_id: 10,
        channel_id: 20,
      },
    });
  });

  test("unsafe numeric-looking route param では購読しない", async () => {
    usePathnameMock.mockReturnValue("/channels/10e2/20");

    render(<WsAuthBridge />);

    await waitFor(() => {
      expect(FakeWebSocket.instances.length).toBe(1);
    });

    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) {
      throw new Error("socket should exist");
    }

    act(() => {
      socket.emitOpen();
      socket.emitJsonMessage({ type: "auth.ready" });
    });

    await waitFor(() => {
      expect(socket.send).toHaveBeenCalledTimes(1);
    });
  });

  test("safe integer を超える id でも購読 payload を丸めない", async () => {
    usePathnameMock.mockReturnValue("/channels/9007199254740993/9007199254740995");

    render(<WsAuthBridge />);

    await waitFor(() => {
      expect(FakeWebSocket.instances.length).toBe(1);
    });

    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) {
      throw new Error("socket should exist");
    }

    act(() => {
      socket.emitOpen();
      socket.emitJsonMessage({ type: "auth.ready" });
    });

    await waitFor(() => {
      expect(socket.send).toHaveBeenCalledTimes(2);
    });

    expect(String(socket.send.mock.calls[1]?.[0])).toBe(
      '{"type":"message.subscribe","d":{"guild_id":9007199254740993,"channel_id":9007199254740995}}',
    );
  });

  test("message.created を受けると該当 channel cache を更新する", async () => {
    usePathnameMock.mockReturnValue("/channels/10/20");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData<InfiniteData<MessagePage, string | null>>(
      buildMessagesQueryKey("10", "20"),
      {
        pageParams: [null],
        pages: [
          {
            items: [],
            nextBefore: null,
            nextAfter: null,
            hasMore: false,
          },
        ],
      },
    );

    renderWithQueryClient(<WsAuthBridge />, queryClient);

    await waitFor(() => {
      expect(FakeWebSocket.instances.length).toBe(1);
    });

    const socket = FakeWebSocket.instances[0];
    if (socket === undefined) {
      throw new Error("socket should exist");
    }

    act(() => {
      socket.emitOpen();
      socket.emitJsonMessage({ type: "auth.ready" });
      socket.emitJsonMessage({
        type: "message.created",
        d: {
          guild_id: 10,
          channel_id: 20,
          message: {
            message_id: 5001,
            guild_id: 10,
            channel_id: 20,
            author_id: 9003,
            content: "hello ws",
            created_at: "2026-03-10T10:00:00Z",
            version: 1,
            edited_at: null,
            is_deleted: false,
          },
        },
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(
        buildMessagesQueryKey("10", "20"),
      );
      expect(cached?.pages[0]?.items).toEqual([
        expect.objectContaining({
          id: "5001",
          content: "hello ws",
        }),
      ]);
    });
  });

  test("再接続後の ready で active channel 履歴を再取得する", async () => {
    vi.useFakeTimers();
    usePathnameMock.mockReturnValue("/channels/10/20");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderWithQueryClient(<WsAuthBridge />, queryClient);

    await waitFor(() => {
      expect(FakeWebSocket.instances.length).toBe(1);
    });

    const socket1 = FakeWebSocket.instances[0];
    if (socket1 === undefined) {
      throw new Error("socket1 should exist");
    }

    act(() => {
      socket1.emitOpen();
      socket1.emitJsonMessage({ type: "auth.ready" });
      socket1.emitClose(1011, "AUTH_UNAVAILABLE");
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await flushMicrotasks();
    });

    await waitFor(() => {
      expect(FakeWebSocket.instances.length).toBe(2);
    });

    const socket2 = FakeWebSocket.instances[1];
    if (socket2 === undefined) {
      throw new Error("socket2 should exist");
    }

    act(() => {
      socket2.emitOpen();
      socket2.emitJsonMessage({ type: "auth.ready" });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: buildMessagesQueryKey("10", "20"),
      });
    });
  });

  test("保護ルート以外では接続しない", async () => {
    usePathnameMock.mockReturnValue("/login");

    render(<WsAuthBridge />);

    await Promise.resolve();

    expect(issueWsTicketMock).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances.length).toBe(0);
  });
});
