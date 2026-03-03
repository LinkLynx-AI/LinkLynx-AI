"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/entities/auth/ui/auth-provider";
import { APP_ROUTES } from "@/shared/config";

type AuthGuardProps = {
  children: React.ReactNode;
};

/**
 * 未認証ユーザーをログインページへリダイレクトするクライアントコンポーネント。
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const session = useAuthSession();

  useEffect(() => {
    if (session.status === "unauthenticated") {
      window.location.assign(APP_ROUTES.login);
    }
  }, [session.status]);

  if (session.status === "initializing") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-discord-bg-tertiary">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-discord-brand-blurple border-t-transparent" />
          <p className="text-sm text-discord-text-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (session.status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
}
