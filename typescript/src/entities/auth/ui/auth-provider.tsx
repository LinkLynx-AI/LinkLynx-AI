"use client";

import { onAuthStateChanged } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ensureFirebaseAuthPersistence, getFirebaseAuth } from "@/shared/lib";
import type { AuthSession, AuthSessionContextValue } from "../model";
import {
  createAuthenticatedSession,
  createUnauthenticatedSession,
  INITIAL_AUTH_SESSION,
  resolveIdToken,
  toAuthUser,
} from "../model/session";

type AuthProviderProps = {
  children: React.ReactNode;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

/**
 * Firebase認証状態を購読し、アプリ全体へ認証セッションを提供する。
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession>(INITIAL_AUTH_SESSION);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;
    const auth = getFirebaseAuth();

    void ensureFirebaseAuthPersistence()
      .then(() => {
        if (!isMounted) {
          return;
        }

        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (!isMounted) {
            return;
          }

          if (user === null) {
            setSession(createUnauthenticatedSession());
            return;
          }

          setSession(createAuthenticatedSession(toAuthUser(user)));
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setSession(createUnauthenticatedSession());
      });

    return () => {
      isMounted = false;
      if (unsubscribe !== null) {
        unsubscribe();
      }
    };
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      ...session,
      getIdToken: (forceRefresh = false) =>
        resolveIdToken(getFirebaseAuth().currentUser, forceRefresh),
    }),
    [session],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

/**
 * 現在の認証セッションと共通IDトークン取得APIを参照する。
 */
export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);

  if (context === null) {
    throw new Error("useAuthSession must be used within AuthProvider.");
  }

  return context;
}
