import { describe, expect, test } from "vitest";
import {
  createAuthenticatedSession,
  createUnauthenticatedSession,
  INITIAL_AUTH_SESSION,
  resolveIdToken,
  toAuthUser,
} from "./session";

describe("auth session helpers", () => {
  test("初期セッションは initializing", () => {
    expect(INITIAL_AUTH_SESSION).toEqual({
      status: "initializing",
      user: null,
    });
  });

  test("Firebase User を AuthUser に変換する", () => {
    const result = toAuthUser({
      uid: "alice",
      email: "alice@example.com",
      emailVerified: true,
    });

    expect(result).toEqual({
      uid: "alice",
      email: "alice@example.com",
      emailVerified: true,
    });
  });

  test("認証済みセッションを生成する", () => {
    const session = createAuthenticatedSession({
      uid: "bob",
      email: "bob@example.com",
      emailVerified: true,
    });

    expect(session).toEqual({
      status: "authenticated",
      user: {
        uid: "bob",
        email: "bob@example.com",
        emailVerified: true,
      },
    });
  });

  test("未認証セッションを生成する", () => {
    const session = createUnauthenticatedSession();

    expect(session).toEqual({
      status: "unauthenticated",
      user: null,
    });
  });

  test("共通トークンAPIは認証済みユーザーからIDトークンを取得する", async () => {
    const token = await resolveIdToken(
      {
        getIdToken: async (forceRefresh = false) =>
          forceRefresh ? "force-refresh-token" : "default-token",
      },
      true,
    );

    expect(token).toBe("force-refresh-token");
  });

  test("共通トークンAPIは未認証時に null を返す", async () => {
    const token = await resolveIdToken(null, true);

    expect(token).toBeNull();
  });
});
