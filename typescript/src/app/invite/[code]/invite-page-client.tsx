"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { type InvitePageContent, useAuthSession } from "@/entities";
import { buildVerifyEmailRoute, InviteRoutePreview, joinInvite } from "@/features";
import { APP_ROUTES, buildGuildRoute, buildInviteRoute, buildLoginRoute } from "@/shared/config";

type InvitePageClientProps = {
  content: InvitePageContent;
  autoJoin: boolean;
};

type InviteJoinNotice = {
  tone: "info" | "error";
  text: string;
} | null;

const PRIMARY_ACTION_CLASSNAME =
  "inline-flex h-11 flex-1 items-center justify-center rounded-[8px] bg-discord-brand-blurple px-4 text-sm font-semibold text-white transition hover:bg-discord-btn-blurple-hover disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_ACTION_CLASSNAME =
  "inline-flex h-11 flex-1 items-center justify-center rounded-[8px] border border-discord-divider px-4 text-sm font-semibold text-discord-text-normal transition hover:bg-discord-bg-secondary";

function resolveJoinErrorMessage(code: string): string {
  switch (code) {
    case "rate-limited":
      return "参加リクエストが多すぎます。少し待ってから再試行してください。";
    case "temporarily-unavailable":
    case "network-request-failed":
      return "現在、参加処理に失敗しました。時間をおいて再試行してください。";
    default:
      return "招待への参加に失敗しました。時間をおいて再試行してください。";
  }
}

export function InvitePageClient({ content, autoJoin }: InvitePageClientProps) {
  const router = useRouter();
  const session = useAuthSession();
  const [isJoining, setIsJoining] = useState(false);
  const [notice, setNotice] = useState<InviteJoinNotice>(null);
  const hasTriggeredAutoJoinRef = useRef(false);

  const loginHref = buildLoginRoute({
    inviteCode: content.inviteCode,
  });
  const sessionExpiredLoginHref = buildLoginRoute({
    inviteCode: content.inviteCode,
    reason: "session-expired",
  });
  const verifyEmailHref = buildVerifyEmailRoute({
    email: session.user?.email ?? null,
    inviteCode: content.inviteCode,
  });

  const handleJoinAttempt = useCallback(async () => {
    if (content.status !== "valid" || isJoining) {
      return;
    }

    if (session.status !== "authenticated") {
      router.replace(loginHref);
      return;
    }

    if (session.user?.emailVerified !== true) {
      router.replace(verifyEmailHref);
      return;
    }

    setIsJoining(true);
    setNotice(null);

    const result = await joinInvite(content.inviteCode);
    if (!result.ok) {
      setIsJoining(false);

      switch (result.error.code) {
        case "unauthenticated":
        case "token-unavailable":
          router.replace(sessionExpiredLoginHref);
          return;
        case "email-not-verified":
          router.replace(verifyEmailHref);
          return;
        case "invalid-invite":
        case "expired-invite":
          router.replace(buildInviteRoute(content.inviteCode));
          return;
        default:
          setNotice({
            tone: "error",
            text: resolveJoinErrorMessage(result.error.code),
          });
          return;
      }
    }

    router.replace(buildGuildRoute(result.data.guildId));
  }, [
    content.inviteCode,
    content.status,
    isJoining,
    loginHref,
    router,
    session.status,
    session.user?.emailVerified,
    sessionExpiredLoginHref,
    verifyEmailHref,
  ]);

  useEffect(() => {
    if (!autoJoin || content.status !== "valid" || session.status !== "authenticated") {
      return;
    }

    if (hasTriggeredAutoJoinRef.current) {
      return;
    }

    hasTriggeredAutoJoinRef.current = true;
    const timerId = window.setTimeout(() => {
      void handleJoinAttempt();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [autoJoin, content.status, handleJoinAttempt, session.status]);

  let primaryActionElement: ReactNode | undefined;
  if (content.status === "valid") {
    if (session.status === "initializing") {
      primaryActionElement = (
        <button type="button" disabled className={PRIMARY_ACTION_CLASSNAME}>
          認証を確認中...
        </button>
      );
    } else if (session.status !== "authenticated") {
      primaryActionElement = (
        <a href={loginHref} className={PRIMARY_ACTION_CLASSNAME}>
          ログインして参加
        </a>
      );
    } else if (session.user?.emailVerified !== true) {
      primaryActionElement = (
        <a href={verifyEmailHref} className={PRIMARY_ACTION_CLASSNAME}>
          メール確認して参加
        </a>
      );
    } else {
      primaryActionElement = (
        <button
          type="button"
          disabled={isJoining}
          className={PRIMARY_ACTION_CLASSNAME}
          onClick={() => {
            void handleJoinAttempt();
          }}
        >
          {isJoining ? "参加中..." : "サーバーに参加"}
        </button>
      );
    }
  }

  const secondaryHref =
    content.status === "valid" && session.status === "authenticated"
      ? APP_ROUTES.channels.me
      : content.secondaryAction.href;
  const secondaryLabel =
    content.status === "valid" && session.status === "authenticated"
      ? "@me へ戻る"
      : content.secondaryAction.label;
  const secondaryActionElement = (
    <a href={secondaryHref} className={SECONDARY_ACTION_CLASSNAME}>
      {secondaryLabel}
    </a>
  );

  return (
    <InviteRoutePreview
      {...content}
      notice={notice}
      primaryActionElement={primaryActionElement}
      secondaryActionElement={secondaryActionElement}
    />
  );
}
