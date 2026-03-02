import type { User as FirebaseUser } from "firebase/auth";
import type { AuthSession, AuthUser } from "./index";

type FirebaseTokenUser = Pick<FirebaseUser, "getIdToken">;
type FirebaseIdentityUser = Pick<FirebaseUser, "uid" | "email" | "emailVerified">;

export const INITIAL_AUTH_SESSION: AuthSession = {
  status: "initializing",
  user: null,
};

/**
 * Firebase User をAuthUserに変換する。
 */
export function toAuthUser(user: FirebaseIdentityUser): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

/**
 * 認証済みセッションを生成する。
 */
export function createAuthenticatedSession(user: AuthUser): AuthSession {
  return {
    status: "authenticated",
    user,
  };
}

/**
 * 未認証セッションを生成する。
 */
export function createUnauthenticatedSession(): AuthSession {
  return {
    status: "unauthenticated",
    user: null,
  };
}

/**
 * 現在ユーザーからIDトークンを解決する。
 */
export async function resolveIdToken(
  currentUser: FirebaseTokenUser | null,
  forceRefresh = false,
): Promise<string | null> {
  if (currentUser === null) {
    return null;
  }

  return currentUser.getIdToken(forceRefresh);
}
