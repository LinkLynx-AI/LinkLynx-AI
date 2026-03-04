"use client";

import { usePathname } from "next/navigation";
import { z } from "zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildLoginRoute,
  classifyAppRoute,
  normalizeReturnToPath,
  type RouteAccessKind,
} from "@/shared/config";
import {
  createInitialWsConnectionState,
  issueWsTicket,
  signOutCurrentUser,
  useAuthSession,
  type WsCloseKind,
  type WsConnectionState,
  type WsTicketIssueError,
} from "@/entities/auth";

const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const RETRY_COUNTDOWN_INTERVAL_MS = 250;

const WS_READY_EVENT_SCHEMA = z.object({
  type: z.literal("auth.ready"),
});

const WS_REAUTH_EVENT_SCHEMA = z.object({
  type: z.literal("auth.reauthenticate"),
});

function resolveCurrentReturnToPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeReturnToPath(`${window.location.pathname}${window.location.search}`);
}

function computeReconnectDelayMs(attempt: number): number {
  const normalizedAttempt = Math.max(attempt, 1);
  const baseDelay = BASE_RECONNECT_DELAY_MS * 2 ** (normalizedAttempt - 1);
  return Math.min(baseDelay, MAX_RECONNECT_DELAY_MS);
}

function resolveWebSocketUrl(apiBaseUrl: string): string {
  const parsedApiBaseUrl = new URL(apiBaseUrl);
  if (parsedApiBaseUrl.protocol !== "http:" && parsedApiBaseUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_URL must use http or https protocol.");
  }
  if (parsedApiBaseUrl.username !== "" || parsedApiBaseUrl.password !== "") {
    throw new Error("NEXT_PUBLIC_API_URL must not contain userinfo.");
  }
  if (parsedApiBaseUrl.hostname.trim().length === 0) {
    throw new Error("NEXT_PUBLIC_API_URL must include a hostname.");
  }

  parsedApiBaseUrl.protocol = parsedApiBaseUrl.protocol === "https:" ? "wss:" : "ws:";

  const normalizedPathname = parsedApiBaseUrl.pathname.replace(/\/+$/, "");
  parsedApiBaseUrl.pathname = `${normalizedPathname}/ws`.replace(/\/{2,}/g, "/");
  parsedApiBaseUrl.search = "";
  parsedApiBaseUrl.hash = "";

  return parsedApiBaseUrl.toString();
}

function resolveWsCloseKind(code: number, wasClean: boolean): WsCloseKind {
  if (code === 1008) {
    return "policy-violation";
  }

  if (code === 1011) {
    return "dependency-unavailable";
  }

  if (wasClean) {
    return "normal";
  }

  return "transport-error";
}

function isDeterministicWsTicketAuthError(code: string): boolean {
  return code === "unauthenticated" || code === "token-unavailable" || code === "forbidden";
}

function shouldShowServiceUnavailableBannerForTicketError(code: string): boolean {
  return code === "temporarily-unavailable" || code === "unknown" || code === "unexpected-response";
}

function createIdentifyMessage(ticket: string): string {
  return JSON.stringify({
    type: "auth.identify",
    d: {
      method: "ticket",
      ticket,
    },
  });
}

/**
 * 認証済み保護ルートでWS identify接続を維持する。
 */
export function WsAuthBridge() {
  const session = useAuthSession();
  const pathname = usePathname();

  const routeAccessKind = useMemo<RouteAccessKind>(() => classifyAppRoute(pathname), [pathname]);

  const shouldConnect = session.status === "authenticated" && routeAccessKind === "protected";

  const [connectionState, setConnectionState] = useState<WsConnectionState>(
    createInitialWsConnectionState,
  );
  const [isServiceUnavailable, setIsServiceUnavailable] = useState(false);
  const [retryDeadlineAtMs, setRetryDeadlineAtMs] = useState<number | null>(null);
  const [retrySecondsRemaining, setRetrySecondsRemaining] = useState<number | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const connectInFlightRef = useRef(false);
  const connectGenerationRef = useRef(0);
  const shouldConnectRef = useRef(shouldConnect);
  const intentionallyClosingSocketRef = useRef<WebSocket | null>(null);
  const redirectingRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current === null) {
      setRetryDeadlineAtMs(null);
      setRetrySecondsRemaining(null);
      return;
    }

    window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    setRetryDeadlineAtMs(null);
    setRetrySecondsRemaining(null);
  }, []);

  const closeCurrentSocket = useCallback(() => {
    const currentSocket = socketRef.current;
    if (currentSocket === null) {
      return;
    }

    intentionallyClosingSocketRef.current = currentSocket;
    socketRef.current = null;
    currentSocket.close();
  }, []);

  const startConnectAttempt = useCallback((): number | null => {
    if (connectInFlightRef.current) {
      return null;
    }

    connectInFlightRef.current = true;
    connectGenerationRef.current += 1;
    return connectGenerationRef.current;
  }, []);

  const finishConnectAttempt = useCallback((generation: number) => {
    if (connectGenerationRef.current !== generation) {
      return;
    }

    connectInFlightRef.current = false;
  }, []);

  const cancelConnectAttempts = useCallback(() => {
    connectGenerationRef.current += 1;
    connectInFlightRef.current = false;
  }, []);

  const redirectToLogin = useCallback(async () => {
    if (redirectingRef.current) {
      return;
    }

    redirectingRef.current = true;
    cancelConnectAttempts();
    clearReconnectTimer();
    closeCurrentSocket();

    await signOutCurrentUser();

    if (typeof window === "undefined") {
      return;
    }

    const loginHref = buildLoginRoute({
      returnTo: resolveCurrentReturnToPath(),
      reason: "session-expired",
    });
    window.location.replace(loginHref);
  }, [cancelConnectAttempts, clearReconnectTimer, closeCurrentSocket]);

  const scheduleReconnect = useCallback(
    (params: {
      closeCode: number | null;
      closeReason: string | null;
      closeKind: WsCloseKind;
      showServiceUnavailableBanner: boolean;
    }) => {
      if (!shouldConnectRef.current || redirectingRef.current) {
        return;
      }

      clearReconnectTimer();

      const nextAttempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = nextAttempt;
      const nextRetryInMs = computeReconnectDelayMs(nextAttempt);
      const nextRetryAtMs = Date.now() + nextRetryInMs;

      setIsServiceUnavailable(params.showServiceUnavailableBanner);
      if (params.showServiceUnavailableBanner) {
        setRetryDeadlineAtMs(nextRetryAtMs);
        setRetrySecondsRemaining(Math.ceil(nextRetryInMs / 1_000));
      } else {
        setRetryDeadlineAtMs(null);
        setRetrySecondsRemaining(null);
      }
      setConnectionState({
        phase: "closed",
        closeCode: params.closeCode,
        closeReason: params.closeReason,
        closeKind: params.closeKind,
        reconnectAttempt: nextAttempt,
        nextRetryInMs,
      });

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        setRetryDeadlineAtMs(null);
        setRetrySecondsRemaining(null);
        connectRef.current();
      }, nextRetryInMs);
    },
    [clearReconnectTimer],
  );

  const setConnectingState = useCallback(() => {
    setConnectionState({
      phase: "connecting",
      closeCode: null,
      closeReason: null,
      closeKind: null,
      reconnectAttempt: reconnectAttemptRef.current,
      nextRetryInMs: null,
    });
  }, []);

  const scheduleDependencyUnavailableReconnect = useCallback(
    (params: {
      message: string;
      status: number | null;
      showServiceUnavailableBanner?: boolean;
    }) => {
      scheduleReconnect({
        closeCode: params.status,
        closeReason: params.message,
        closeKind: "dependency-unavailable",
        showServiceUnavailableBanner: params.showServiceUnavailableBanner ?? true,
      });
    },
    [scheduleReconnect],
  );

  const handleTicketIssueFailure = useCallback(
    async (error: WsTicketIssueError) => {
      if (isDeterministicWsTicketAuthError(error.code)) {
        await redirectToLogin();
        return;
      }

      scheduleDependencyUnavailableReconnect({
        status: error.status,
        message: error.message,
        showServiceUnavailableBanner: shouldShowServiceUnavailableBannerForTicketError(error.code),
      });
    },
    [redirectToLogin, scheduleDependencyUnavailableReconnect],
  );

  const handleSocketReady = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setIsServiceUnavailable(false);
    setConnectionState({
      phase: "ready",
      closeCode: null,
      closeReason: null,
      closeKind: null,
      reconnectAttempt: 0,
      nextRetryInMs: null,
    });
  }, []);

  const handleSocketReauthenticate = useCallback(
    async (socket: WebSocket) => {
      let refreshedToken: string | null;
      try {
        refreshedToken = await session.getIdToken(true);
      } catch {
        await redirectToLogin();
        return;
      }

      if (refreshedToken === null || refreshedToken.trim().length === 0) {
        await redirectToLogin();
        return;
      }

      if (socketRef.current !== socket) {
        return;
      }

      socket.send(
        JSON.stringify({
          type: "auth.reauthenticate",
          d: {
            idToken: refreshedToken,
          },
        }),
      );
    },
    [redirectToLogin, session],
  );

  const handleSocketClose = useCallback(
    (params: { socket: WebSocket; connectGeneration: number; event: CloseEvent }) => {
      const { socket, connectGeneration, event } = params;
      if (intentionallyClosingSocketRef.current === socket) {
        intentionallyClosingSocketRef.current = null;
        finishConnectAttempt(connectGeneration);
        return;
      }

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      finishConnectAttempt(connectGeneration);
      const closeKind = resolveWsCloseKind(event.code, event.wasClean);
      setConnectionState({
        phase: "closed",
        closeCode: event.code,
        closeReason: event.reason === "" ? null : event.reason,
        closeKind,
        reconnectAttempt: reconnectAttemptRef.current,
        nextRetryInMs: null,
      });

      if (!shouldConnectRef.current || redirectingRef.current) {
        return;
      }

      if (event.code === 1008) {
        void redirectToLogin();
        return;
      }

      scheduleReconnect({
        closeCode: event.code,
        closeReason: event.reason === "" ? null : event.reason,
        closeKind,
        showServiceUnavailableBanner: event.code === 1011,
      });
    },
    [finishConnectAttempt, redirectToLogin, scheduleReconnect],
  );

  const bindSocketHandlers = useCallback(
    (params: { socket: WebSocket; connectGeneration: number; ticket: string }) => {
      const { socket, connectGeneration, ticket } = params;

      socket.onopen = () => {
        if (socketRef.current !== socket) {
          return;
        }

        finishConnectAttempt(connectGeneration);
        setIsServiceUnavailable(false);
        setConnectionState((currentState) => ({
          ...currentState,
          phase: "identifying",
          closeCode: null,
          closeReason: null,
          closeKind: null,
          nextRetryInMs: null,
        }));

        socket.send(createIdentifyMessage(ticket));
      };

      socket.onmessage = (event) => {
        if (socketRef.current !== socket || typeof event.data !== "string") {
          return;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        if (WS_READY_EVENT_SCHEMA.safeParse(payload).success) {
          handleSocketReady();
          return;
        }

        if (!WS_REAUTH_EVENT_SCHEMA.safeParse(payload).success) {
          return;
        }

        void handleSocketReauthenticate(socket);
      };

      socket.onclose = (event) => {
        handleSocketClose({
          socket,
          connectGeneration,
          event,
        });
      };

      socket.onerror = () => {
        if (socketRef.current !== socket) {
          return;
        }

        finishConnectAttempt(connectGeneration);
        setConnectionState((currentState) => ({
          ...currentState,
          phase: "closed",
          closeKind: "transport-error",
        }));
      };
    },
    [finishConnectAttempt, handleSocketClose, handleSocketReady, handleSocketReauthenticate],
  );

  const connect = useCallback(async () => {
    if (!shouldConnectRef.current || redirectingRef.current) {
      return;
    }

    const connectGeneration = startConnectAttempt();
    if (connectGeneration === null) {
      return;
    }

    clearReconnectTimer();
    closeCurrentSocket();
    setConnectingState();

    const ticketResult = await issueWsTicket();
    if (!shouldConnectRef.current || redirectingRef.current) {
      finishConnectAttempt(connectGeneration);
      return;
    }

    if (!ticketResult.ok) {
      finishConnectAttempt(connectGeneration);
      await handleTicketIssueFailure(ticketResult.error);
      return;
    }

    let wsUrl: string;
    try {
      wsUrl = resolveWebSocketUrl(process.env.NEXT_PUBLIC_API_URL ?? "");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "WebSocket URL の解決に失敗しました。";
      finishConnectAttempt(connectGeneration);
      scheduleDependencyUnavailableReconnect({
        status: null,
        message,
      });
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "WebSocket 接続の開始に失敗しました。";
      finishConnectAttempt(connectGeneration);
      scheduleDependencyUnavailableReconnect({
        status: null,
        message,
      });
      return;
    }

    socketRef.current = socket;
    bindSocketHandlers({
      socket,
      connectGeneration,
      ticket: ticketResult.data.ticket,
    });
  }, [
    bindSocketHandlers,
    clearReconnectTimer,
    closeCurrentSocket,
    finishConnectAttempt,
    handleTicketIssueFailure,
    scheduleDependencyUnavailableReconnect,
    setConnectingState,
    startConnectAttempt,
  ]);

  useEffect(() => {
    connectRef.current = () => {
      void connect();
    };
  }, [connect]);

  useEffect(() => {
    shouldConnectRef.current = shouldConnect;
  }, [shouldConnect]);

  useEffect(() => {
    if (retryDeadlineAtMs === null) {
      setRetrySecondsRemaining(null);
      return;
    }

    const updateCountdown = () => {
      const remainingMs = Math.max(0, retryDeadlineAtMs - Date.now());
      setRetrySecondsRemaining(Math.ceil(remainingMs / 1_000));
    };

    updateCountdown();
    const timerId = window.setInterval(updateCountdown, RETRY_COUNTDOWN_INTERVAL_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [retryDeadlineAtMs]);

  useEffect(() => {
    if (!shouldConnect) {
      cancelConnectAttempts();
      clearReconnectTimer();
      closeCurrentSocket();
      reconnectAttemptRef.current = 0;
      redirectingRef.current = false;
      setIsServiceUnavailable(false);
      setRetryDeadlineAtMs(null);
      setRetrySecondsRemaining(null);
      setConnectionState(createInitialWsConnectionState());
      return;
    }

    void connect();

    return () => {
      cancelConnectAttempts();
      clearReconnectTimer();
      closeCurrentSocket();
    };
  }, [shouldConnect, cancelConnectAttempts, clearReconnectTimer, closeCurrentSocket, connect]);

  const retryNow = useCallback(() => {
    if (!isServiceUnavailable || connectInFlightRef.current) {
      return;
    }

    clearReconnectTimer();
    connectRef.current();
  }, [clearReconnectTimer, isServiceUnavailable]);

  if (!shouldConnect || !isServiceUnavailable) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-3">
      <section
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-md border border-amber-300/40 bg-amber-950/90 px-4 py-3 text-amber-100 shadow-lg"
      >
        <p className="text-sm">
          認証基盤が一時的に利用できません。時間をおいて再接続します。
          {retrySecondsRemaining === null ? null : `（次回再試行まで ${retrySecondsRemaining} 秒）`}
        </p>
        <button
          type="button"
          onClick={retryNow}
          disabled={connectionState.phase !== "closed"}
          className="rounded-md border border-amber-200/60 bg-transparent px-3 py-1 text-sm font-medium text-amber-100 transition hover:bg-amber-200/10"
        >
          今すぐ再試行
        </button>
      </section>
    </div>
  );
}
