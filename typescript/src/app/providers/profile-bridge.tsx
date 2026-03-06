"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/entities/auth";
import { useMyProfile, useStorageObjectUrl } from "@/shared/api/queries";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { User } from "@/shared/model/types/user";

function buildFallbackUsername(email: string | null, currentUsername: string | null): string {
  if (currentUsername !== null && currentUsername.length > 0) {
    return currentUsername;
  }

  return email?.split("@")[0] ?? "User";
}

function areEquivalentUsers(left: User | null, right: User): boolean {
  if (left === null) {
    return false;
  }

  return (
    left.id === right.id &&
    left.username === right.username &&
    left.displayName === right.displayName &&
    left.avatar === right.avatar &&
    left.status === right.status &&
    left.customStatus === right.customStatus &&
    left.bot === right.bot
  );
}

/**
 * 保存済みプロフィール情報を auth-store へ再水和する。
 */
export function ProfileBridge() {
  const session = useAuthSession();
  const currentUser = useAuthStore((s) => s.currentUser);
  const customStatus = useAuthStore((s) => s.customStatus);
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const setCustomStatus = useAuthStore((s) => s.setCustomStatus);

  const sessionUserId =
    session.status === "authenticated" && session.user !== null ? session.user.uid : null;
  const { data: myProfile } = useMyProfile(sessionUserId);
  const { data: avatarUrl } = useStorageObjectUrl(myProfile?.avatarKey ?? null);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user === null || myProfile === undefined) {
      return;
    }

    const nextUsername = buildFallbackUsername(session.user.email, currentUser?.username ?? null);
    const nextAvatar =
      myProfile.avatarKey === null ? null : (avatarUrl ?? currentUser?.avatar ?? null);
    const nextUser: User = {
      id: session.user.uid,
      username: nextUsername,
      displayName: myProfile.displayName,
      avatar: nextAvatar,
      status: currentUser?.status ?? "online",
      customStatus: myProfile.statusText,
      bot: currentUser?.bot ?? false,
    };

    if (!areEquivalentUsers(currentUser, nextUser)) {
      setCurrentUser(nextUser);
    }
    if (customStatus !== myProfile.statusText) {
      setCustomStatus(myProfile.statusText);
    }
  }, [
    avatarUrl,
    currentUser,
    customStatus,
    myProfile,
    session.status,
    session.user,
    setCurrentUser,
    setCustomStatus,
  ]);

  return null;
}
