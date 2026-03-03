import { getFirebaseAuth } from "@/shared/lib";
import type { AuthenticatedFetchResult } from "../model";
import { createAuthenticatedFetchError } from "../model";

type AuthenticatedFetchOptions = {
  forceRefresh?: boolean;
};

/**
 * Firebase IDトークンをBearer付与してfetchを実行する。
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: AuthenticatedFetchOptions = {},
): Promise<AuthenticatedFetchResult> {
  const currentUser = getFirebaseAuth().currentUser;
  if (currentUser === null) {
    return {
      ok: false,
      error: createAuthenticatedFetchError({
        code: "unauthenticated",
        message: "ログイン中のユーザーが見つかりません。",
      }),
    };
  }

  let idToken: string;
  try {
    idToken = await currentUser.getIdToken(options.forceRefresh ?? false);
  } catch {
    return {
      ok: false,
      error: createAuthenticatedFetchError({
        code: "token-unavailable",
        message: "IDトークンの取得に失敗しました。",
      }),
    };
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${idToken}`);

  try {
    const response = await fetch(input, {
      ...init,
      headers,
    });

    return {
      ok: true,
      response,
    };
  } catch {
    return {
      ok: false,
      error: createAuthenticatedFetchError({
        code: "network-request-failed",
        message: "認証APIへの接続に失敗しました。",
      }),
    };
  }
}
