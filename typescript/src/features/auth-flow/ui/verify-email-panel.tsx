"use client";

import { useMemo, useState } from "react";
import { reloadCurrentAuthUser, sendVerificationEmailForCurrentUser, useAuthSession } from "@/entities";
import { APP_ROUTES } from "@/shared/config";
import { getVerifyEmailErrorMessage } from "../model";

type VerifyEmailPanelProps = {
  initialEmail: string | null;
  initialSent: string | null;
};

type NoticeTone = "info" | "success" | "error";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

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

/**
 * メール確認導線（再送・確認状態更新）を表示する。
 */
export function VerifyEmailPanel({ initialEmail, initialSent }: VerifyEmailPanelProps) {
  const session = useAuthSession();
  const [notice, setNotice] = useState<NoticeState | null>(() => resolveInitialNotice(initialSent));
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const targetEmail = useMemo(() => {
    const sessionEmail = session.user?.email?.trim();
    if (sessionEmail !== undefined && sessionEmail !== "") {
      return sessionEmail;
    }

    const queryEmail = initialEmail?.trim() ?? "";
    return queryEmail === "" ? null : queryEmail;
  }, [initialEmail, session.user?.email]);

  const isAuthenticated = session.status === "authenticated";

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
    if (!isAuthenticated) {
      setNotice({
        tone: "error",
        text: "確認状態を更新するにはログインが必要です。",
      });
      return;
    }

    setIsRefreshing(true);
    const result = await reloadCurrentAuthUser();
    setIsRefreshing(false);

    if (!result.ok) {
      setNotice({
        tone: "error",
        text: getVerifyEmailErrorMessage(result.error),
      });
      return;
    }

    if (result.data.emailVerified) {
      window.location.assign(APP_ROUTES.channels.me);
      return;
    }

    setNotice({
      tone: "info",
      text: "まだ確認が完了していません。メール内リンクを開いた後に再度更新してください。",
    });
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1 text-sm text-discord-text-muted">
        <p>ログインメール: {targetEmail ?? "未指定"}</p>
        <p>確認完了後に「確認状態を更新」を押すと次画面へ進みます。</p>
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
