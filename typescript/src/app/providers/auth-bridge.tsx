"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/entities/auth";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { User } from "@/shared/model/types/user";

/**
 * Firebase認証セッションをmoc-designのZustand auth-storeへ同期するブリッジ。
 * UIコンポーネントがZustand経由でユーザー情報を参照できるようにする。
 */
export function AuthBridge() {
  const session = useAuthSession();
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user === null) {
      setCurrentUser(null);
      return;
    }

    const { user } = session;
    const username = user.email?.split("@")[0] ?? "User";

    const mocUser: User = {
      id: user.uid,
      username,
      displayName: username,
      avatar: null,
      status: "online",
      customStatus: null,
      bot: false,
    };

    setCurrentUser(mocUser);
  }, [session, setCurrentUser]);

  return null;
}
