"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  ensurePrincipalProvisionedForCurrentUser,
  type PrincipalProvisionResult,
  useAuthSession,
} from "@/entities";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import {
  buildLoginRoute,
  type GuardKind,
  type LoginRedirectReason,
  normalizeReturnToPath,
} from "@/shared/config";
import { AuthInitializingScreen } from "./auth-initializing-screen";
import { RouteGuardScreen } from "./route-guard-screen";

type ProtectedPreviewGateProps = {
  guard: GuardKind | null;
  children: React.ReactNode;
};

function resolveCurrentReturnToPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeReturnToPath(`${window.location.pathname}${window.location.search}`);
}

/**
 * クエリ指定に応じて保護ルートのガード画面を切り替える。
 */
export function ProtectedPreviewGate({ guard, children }: ProtectedPreviewGateProps) {
  const session = useAuthSession();
  const setCurrentPrincipalId = useAuthStore((s) => s.setCurrentPrincipalId);
  const isBrowser = typeof window !== "undefined";
  const shouldCheckProvision = guard === null && session.status === "authenticated";
  const provisionQuery = useQuery<PrincipalProvisionResult, Error>({
    queryKey: ["auth", "protected-route-guard", session.user?.uid ?? "anonymous"],
    queryFn: async () => {
      const result = await ensurePrincipalProvisionedForCurrentUser();
      setCurrentPrincipalId(result.ok ? result.data.principalId : null);
      return result;
    },
    enabled: isBrowser && shouldCheckProvision,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const isCheckingProvision = isBrowser && shouldCheckProvision && provisionQuery.isFetching;
  const provisionResult = provisionQuery.data;

  const { visibleGuard, loginReason } = useMemo<{
    visibleGuard: GuardKind | null;
    loginReason: LoginRedirectReason;
  }>(() => {
    if (guard !== null) {
      return {
        visibleGuard: guard,
        loginReason: "unauthenticated",
      };
    }

    if (session.status === "unauthenticated") {
      return {
        visibleGuard: "unauthenticated",
        loginReason: "unauthenticated",
      };
    }

    if (session.status !== "authenticated") {
      return {
        visibleGuard: null,
        loginReason: "unauthenticated",
      };
    }

    if (isCheckingProvision) {
      return {
        visibleGuard: null,
        loginReason: "unauthenticated",
      };
    }

    if (provisionResult === undefined) {
      return {
        visibleGuard: isBrowser ? "service-unavailable" : null,
        loginReason: "unauthenticated",
      };
    }

    if (provisionResult.ok) {
      return {
        visibleGuard: null,
        loginReason: "unauthenticated",
      };
    }

    if (
      provisionResult.error.status === 401 ||
      provisionResult.error.code === "unauthenticated" ||
      provisionResult.error.code === "token-unavailable"
    ) {
      return {
        visibleGuard: "unauthenticated",
        loginReason: "session-expired",
      };
    }

    if (provisionResult.error.status === 403) {
      return {
        visibleGuard: "forbidden",
        loginReason: "unauthenticated",
      };
    }

    if (provisionResult.error.status === 503) {
      return {
        visibleGuard: "service-unavailable",
        loginReason: "unauthenticated",
      };
    }

    return {
      visibleGuard: "service-unavailable",
      loginReason: "unauthenticated",
    };
  }, [guard, isBrowser, isCheckingProvision, provisionResult, session.status]);

  const loginHref = useMemo(
    () =>
      buildLoginRoute({
        returnTo: resolveCurrentReturnToPath(),
        reason: loginReason,
      }),
    [loginReason],
  );

  useEffect(() => {
    if (guard !== null) {
      return;
    }

    if (visibleGuard !== "unauthenticated") {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    window.location.replace(loginHref);
  }, [guard, loginHref, visibleGuard]);

  if (guard !== null) {
    return <RouteGuardScreen kind={guard} />;
  }

  if (session.status === "initializing" || isCheckingProvision) {
    return <AuthInitializingScreen />;
  }

  if (visibleGuard !== null) {
    const routeGuardScreenProps =
      visibleGuard === "unauthenticated"
        ? {
            loginHref,
          }
        : {};

    return <RouteGuardScreen kind={visibleGuard} {...routeGuardScreenProps} />;
  }

  return <>{children}</>;
}
