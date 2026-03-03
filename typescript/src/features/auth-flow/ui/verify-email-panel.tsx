"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthActionError } from "@/entities";
import {
  ensurePrincipalProvisionedForCurrentUser,
  reloadCurrentAuthUser,
  sendVerificationEmailForCurrentUser,
  useAuthSession,
} from "@/entities";
import { APP_ROUTES, normalizeReturnToPath } from "@/shared/config";
import { getPrincipalProvisionErrorMessage, getVerifyEmailErrorMessage } from "../model";

type VerifyEmailPanelProps = {
  initialEmail: string | null;
  initialSent: string | null;
  returnTo: string | null;
};

type NoticeTone = "info" | "success" | "error";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type RefreshTrigger = "manual" | "polling" | "focus" | "visibilitychange";

const AUTO_REFRESH_INTERVAL_MS = 5_000;
const AUTO_REFRESH_TIMEOUT_MS = 5 * 60 * 1_000;
const AUTO_REFRESH_EVENT_COOLDOWN_MS = 1_000;

function resolveInitialNotice(initialSent: string | null): NoticeState | null {
  if (initialSent === "1") {
    return {
      tone: "success",
      text: "確認メールを送信しました。受信ボックスをご確認ください。",
    };
  }

  if (initialSent === "0") {
    return {
      tone: "error",
      text: "確認メールの送信に失敗しました。再送ボタンから再試行してください。",
    };
  }

  return null;
}

function resolveNoticeClassName(tone: NoticeTone): string {
  if (tone === "success") {
    return "bg-discord-btn-success/10 text-discord-btn-success";
  }

  if (tone === "error") {
    return "bg-discord-brand-red/10 text-discord-brand-red";
  }

  return "bg-discord-bg-secondary text-discord-text-muted";
}

function resolveRefreshErrorMessage(error: AuthActionError): string {
  if (error.code === "unauthenticated") {
    return "確認状態を更新するにはログインが必要です。";
  }

  return getVerifyEmailErrorMessage(error);
}

/**
 * メール確認導線（再送・確認状態更新）を表示する。
 */
export function VerifyEmailPanel({ initialEmail, initialSent, returnTo }: VerifyEmailPanelProps) {
  const session = useAuthSession();
  const [notice, setNotice] = useState<NoticeState | null>(() => resolveInitialNotice(initialSent));
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isCheckInFlightRef = useRef(false);
  const isAutoRefreshStoppedRef = useRef(false);
  const autoRefreshStartedAtRef = useRef(0);
  const lastEventTriggeredAtRef = useRef(0);
  const redirectPath = normalizeReturnToPath(returnTo) ?? APP_ROUTES.channels.me;

  const targetEmail = useMemo(() => {
    const sessionEmail = session.user?.email?.trim();
    if (sessionEmail !== undefined && sessionEmail !== "") {
      return sessionEmail;
    }

    const queryEmail = initialEmail?.trim() ?? "";
    return queryEmail === "" ? null : queryEmail;
  }, [initialEmail, session.user?.email]);

  const isAuthenticated = session.status === "authenticated";

  const notifyAutoRefreshStopped = useCallback(() => {
    setNotice({
      tone: "info",
      text: "自動確認を停止しました。必要な場合は「確認状態を更新」を押して再確認してください。",
    });
  }, []);

  const runRefreshCheck = useCallback(
    async (trigger: RefreshTrigger) => {
      const isManualTrigger = trigger === "manual";

      if (!isAuthenticated) {
        if (isManualTrigger) {
          setNotice({
            tone: "error",
            text: "確認状態を更新するにはログインが必要です。",
          });
        }
        return;
      }

      if (!isManualTrigger && isAutoRefreshStoppedRef.current) {
        return;
      }

      if (isCheckInFlightRef.current) {
        return;
      }

      isCheckInFlightRef.current = true;
      if (isManualTrigger) {
        setIsRefreshing(true);
      }

      try {
        const result = await reloadCurrentAuthUser();

        if (!result.ok) {
          setNotice({
            tone: "error",
            text: resolveRefreshErrorMessage(result.error),
          });
          return;
        }

        if (!result.data.emailVerified) {
          if (isManualTrigger) {
            setNotice({
              tone: "info",
              text: "まだ確認が完了していません。メール内リンクを開いた後に再度更新してください。",
            });
          }
          return;
        }

        const provisionResult = await ensurePrincipalProvisionedForCurrentUser({
          forceRefresh: true,
        });

        if (!provisionResult.ok) {
          setNotice({
            tone: "error",
            text: getPrincipalProvisionErrorMessage(provisionResult.error),
          });
          return;
        }

        isAutoRefreshStoppedRef.current = true;
        window.location.assign(redirectPath);
      } finally {
        isCheckInFlightRef.current = false;
        if (isManualTrigger) {
          setIsRefreshing(false);
        }
      }
    },
    [isAuthenticated, redirectPath],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      isAutoRefreshStoppedRef.current = true;
      return;
    }

    isAutoRefreshStoppedRef.current = false;
    autoRefreshStartedAtRef.current = Date.now();
    lastEventTriggeredAtRef.current = 0;

    const stopAutoRefresh = () => {
      if (isAutoRefreshStoppedRef.current) {
        return;
      }

      isAutoRefreshStoppedRef.current = true;
      notifyAutoRefreshStopped();
    };

    const runEventDrivenRefresh = (trigger: "focus" | "visibilitychange") => {
      if (isAutoRefreshStoppedRef.current || document.hidden) {
        return;
      }

      const now = Date.now();
      if (now - lastEventTriggeredAtRef.current < AUTO_REFRESH_EVENT_COOLDOWN_MS) {
        return;
      }

      lastEventTriggeredAtRef.current = now;
      void runRefreshCheck(trigger);
    };

    const intervalId = window.setInterval(() => {
      if (isAutoRefreshStoppedRef.current) {
        return;
      }

      const elapsedTime = Date.now() - autoRefreshStartedAtRef.current;
      if (elapsedTime >= AUTO_REFRESH_TIMEOUT_MS) {
        void runRefreshCheck("polling").finally(() => {
          stopAutoRefresh();
        });
        return;
      }

      if (document.hidden) {
        return;
      }

      void runRefreshCheck("polling");
    }, AUTO_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      runEventDrivenRefresh("focus");
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        runEventDrivenRefresh("visibilitychange");
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isAutoRefreshStoppedRef.current = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, notifyAutoRefreshStopped, runRefreshCheck]);

  async function handleResendClick() {
    if (!isAuthenticated) {
      setNotice({
        tone: "error",
        text: "確認メールを再送するにはログインが必要です。",
      });
      return;
    }

    setIsResending(true);
    const result = await sendVerificationEmailForCurrentUser();
    setIsResending(false);

    if (!result.ok) {
      setNotice({
        tone: "error",
        text: getVerifyEmailErrorMessage(result.error),
      });
      return;
    }

    setNotice({
      tone: "success",
      text: "確認メールを再送しました。受信ボックスをご確認ください。",
    });
  }

  async function handleRefreshClick() {
    await runRefreshCheck("manual");
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1 text-sm text-discord-text-muted">
        <p>ログインメール: {targetEmail ?? "未指定"}</p>
        <p>
          確認完了後は自動で次画面へ進みます。進まない場合は「確認状態を更新」を押してください。
        </p>
      </div>

      {notice !== null && (
        <p className={`rounded px-3 py-2 text-sm ${resolveNoticeClassName(notice.tone)}`}>
          {notice.text}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!isAuthenticated || isResending}
          onClick={() => {
            void handleResendClick();
          }}
          className="rounded bg-discord-brand-blurple px-4 py-2.5 text-sm font-medium text-white transition hover:bg-discord-btn-blurple-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResending ? "送信中..." : "確認メールを再送"}
        </button>
        <button
          type="button"
          disabled={!isAuthenticated || isRefreshing}
          onClick={() => {
            void handleRefreshClick();
          }}
          className="rounded bg-discord-bg-accent px-4 py-2.5 text-sm text-discord-interactive-normal transition hover:bg-discord-btn-secondary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRefreshing ? "更新中..." : "確認状態を更新"}
        </button>
      </div>

      {!isAuthenticated && (
        <p className="text-sm text-discord-text-muted">
          ログイン状態が確認できないため、まず
          <a href={APP_ROUTES.login} className="mx-1 text-discord-text-link hover:underline">
            ログイン
          </a>
          してください。
        </p>
      )}
    </section>
  );
}
