"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/entities/auth";
import { syncMyProfileToAuthStore } from "@/shared/api/my-profile-sync";
import { useMyProfile } from "@/shared/api/queries";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { User } from "@/shared/model/types/user";

function buildSessionBackedUser(
  currentUser: User | null,
  sessionUser: { uid: string; email: string | null },
): User {
  const username = sessionUser.email?.split("@")[0] ?? "User";

  if (currentUser?.id === sessionUser.uid) {
    return {
      ...currentUser,
      username,
      bot: false,
    };
  }

  return {
    id: sessionUser.uid,
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
  const currentUser = useAuthStore((s) => s.currentUser);
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const clearCurrentUser = useAuthStore((s) => s.clearCurrentUser);
  const currentUserId = session.status === "authenticated" ? (session.user?.uid ?? null) : null;
  const { data: myProfile } = useMyProfile(currentUserId);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user === null) {
      clearCurrentUser();
      return;
    }

    const nextUser = buildSessionBackedUser(currentUser, session.user);
    if (!isSameUser(currentUser, nextUser)) {
      setCurrentUser(nextUser);
    }
  }, [clearCurrentUser, currentUser, session.status, session.user, setCurrentUser]);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user === null || myProfile === undefined) {
      return;
    }

    syncMyProfileToAuthStore(myProfile);
  }, [myProfile, session.status, session.user]);

  return null;
}
