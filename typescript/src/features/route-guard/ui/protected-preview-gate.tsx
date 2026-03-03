"use client";

import { useAuthSession } from "@/entities";
import type { GuardKind } from "@/shared/config";
import { AuthInitializingScreen } from "./auth-initializing-screen";
import { RouteGuardScreen } from "./route-guard-screen";

type ProtectedPreviewGateProps = {
  guard: GuardKind | null;
  children: React.ReactNode;
};

/**
 * クエリ指定に応じて保護ルートのガード画面を切り替える。
 */
export function ProtectedPreviewGate({ guard, children }: ProtectedPreviewGateProps) {
  const session = useAuthSession();

  if (guard !== null) {
    return <RouteGuardScreen kind={guard} />;
  }

  if (session.status === "initializing") {
    return <AuthInitializingScreen />;
  }

  if (session.status === "unauthenticated") {
    return <RouteGuardScreen kind="unauthenticated" />;
  }

  return <>{children}</>;
}
