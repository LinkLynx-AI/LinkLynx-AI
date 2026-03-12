"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/entities/auth";
import { getAPIClient } from "@/shared/api/api-client";
import { resolveMyProfileMediaUrls } from "@/shared/api/my-profile-media";
import { syncMyProfileToAuthStore, syncMyProfileToSessionCaches } from "@/shared/api/my-profile-sync";
import { useMyProfile } from "@/shared/api/queries";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { User } from "@/shared/model/types/user";

function buildSessionBackedUser(
  currentUser: User | null,
  sessionUser: { uid: string; email: string | null },
  currentPrincipalId: string | null,
): User {
  const username = sessionUser.email?.split("@")[0] ?? "User";
  const resolvedUserId = currentPrincipalId ?? sessionUser.uid;

  if (currentUser?.id === resolvedUserId) {
    return {
      ...currentUser,
      id: resolvedUserId,
      username,
      bot: false,
    };
  }

  return {
    id: resolvedUserId,
    username,
    displayName: username,
    avatar: null,
    status: "online",
    customStatus: null,
    bot: false,
  };
}

function isSameUser(left: User | null, right: User): boolean {
  return (
    left?.id === right.id &&
    left.username === right.username &&
    left.displayName === right.displayName &&
    left.avatar === right.avatar &&
    left.status === right.status &&
    left.customStatus === right.customStatus &&
    left.bot === right.bot
  );
}

/**
 * Firebase認証セッションをmoc-designのZustand auth-storeへ同期するブリッジ。
 * UIコンポーネントがZustand経由でユーザー情報を参照できるようにする。
 */
export function AuthBridge() {
  const session = useAuthSession();
  const queryClient = useQueryClient();
  const api = getAPIClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentPrincipalId = useAuthStore((s) => s.currentPrincipalId);
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const clearCurrentUser = useAuthStore((s) => s.clearCurrentUser);
  const currentUserId = session.status === "authenticated" ? (session.user?.uid ?? null) : null;
  const { data: myProfile } = useMyProfile(currentUserId);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user === null) {
      clearCurrentUser();
      return;
    }

    const nextUser = buildSessionBackedUser(currentUser, session.user, currentPrincipalId);
    if (!isSameUser(currentUser, nextUser)) {
      setCurrentUser(nextUser);
    }
  }, [
    clearCurrentUser,
    currentPrincipalId,
    currentUser,
    session.status,
    session.user,
    setCurrentUser,
  ]);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user === null || myProfile === undefined) {
      return;
    }

    let cancelled = false;
    void resolveMyProfileMediaUrls(api, myProfile)
      .then((mediaUrls) => {
        if (cancelled) {
          return;
        }

        const resolvedUserId = useAuthStore.getState().currentUser?.id;
        if (resolvedUserId === undefined) {
          syncMyProfileToAuthStore(myProfile, mediaUrls);
          return;
        }

        syncMyProfileToSessionCaches(queryClient, resolvedUserId, myProfile, mediaUrls);
      })
      .catch(() => {
        if (!cancelled) {
          syncMyProfileToAuthStore(myProfile);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, myProfile, queryClient, session.status, session.user]);

  return null;
}
