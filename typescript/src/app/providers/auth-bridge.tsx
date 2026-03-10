"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/entities/auth";
import { syncMyProfileToAuthStore } from "@/shared/api/my-profile-sync";
import { useMyProfile, useStorageObjectUrl } from "@/shared/api/queries";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { User } from "@/shared/model/types/user";

function buildSessionBackedUser(
  currentUser: User | null,
  currentPrincipalId: string | null,
  sessionUser: { uid: string; email: string | null },
): User {
  const resolvedUserId = currentPrincipalId ?? sessionUser.uid;
  const username = sessionUser.email?.split("@")[0] ?? "User";

  if (currentUser?.id === resolvedUserId) {
    return {
      ...currentUser,
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
  const currentPrincipalId = useAuthStore((s) => s.currentPrincipalId);
  const currentUser = useAuthStore((s) => s.currentUser);
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const clearCurrentUser = useAuthStore((s) => s.clearCurrentUser);
  const currentUserId =
    session.status === "authenticated" ? (currentPrincipalId ?? session.user?.uid ?? null) : null;
  const { data: myProfile } = useMyProfile(currentUserId);
  const { data: resolvedAvatarUrl } = useStorageObjectUrl(myProfile?.avatarKey ?? null);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user === null) {
      clearCurrentUser();
      return;
    }

    const nextUser = buildSessionBackedUser(currentUser, currentPrincipalId, session.user);
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
    if (myProfile.avatarKey !== null && resolvedAvatarUrl === undefined) {
      return;
    }

    syncMyProfileToAuthStore(myProfile, resolvedAvatarUrl ?? null);
  }, [myProfile, resolvedAvatarUrl, session.status, session.user]);

  return null;
}
