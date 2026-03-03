import { afterEach, describe, expect, test, vi } from "vitest";

const getFirebaseAuthMock = vi.hoisted(() => vi.fn());
const signInWithEmailAndPasswordMock = vi.hoisted(() => vi.fn());
const createUserWithEmailAndPasswordMock = vi.hoisted(() => vi.fn());
const sendEmailVerificationMock = vi.hoisted(() => vi.fn());
const sendPasswordResetEmailMock = vi.hoisted(() => vi.fn());
const reloadMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib", () => ({
  getFirebaseAuth: getFirebaseAuthMock,
}));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
  reload: reloadMock,
  sendEmailVerification: sendEmailVerificationMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
}));

import {
  loginWithEmailAndPassword,
  registerWithEmailAndPassword,
  reloadCurrentAuthUser,
  sendPasswordResetEmailByAddress,
  sendVerificationEmailForCurrentUser,
} from "./firebase-auth-actions";

describe("firebase auth actions", () => {
  afterEach(() => {
    getFirebaseAuthMock.mockReset();
    signInWithEmailAndPasswordMock.mockReset();
    createUserWithEmailAndPasswordMock.mockReset();
    sendEmailVerificationMock.mockReset();
    sendPasswordResetEmailMock.mockReset();
    reloadMock.mockReset();
  });

  test("login 成功時は AuthUser を返す", async () => {
    getFirebaseAuthMock.mockReturnValue({ currentUser: null });
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: {
        uid: "u-1",
        email: "alice@example.com",
        emailVerified: false,
      },
    });

    const result = await loginWithEmailAndPassword({
      email: "alice@example.com",
      password: "password",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        uid: "u-1",
        email: "alice@example.com",
        emailVerified: false,
      },
    });
  });

  test("login 失敗時は Firebase エラーを正規化する", async () => {
    getFirebaseAuthMock.mockReturnValue({ currentUser: null });
    signInWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/invalid-credential",
      message: "invalid credential",
    });

    const result = await loginWithEmailAndPassword({
      email: "alice@example.com",
      password: "wrong-password",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid-credentials",
        message: "invalid credential",
        firebaseCode: "invalid-credential",
      },
    });
  });

  test("register 成功時は作成ユーザーを返す", async () => {
    getFirebaseAuthMock.mockReturnValue({ currentUser: null });
    createUserWithEmailAndPasswordMock.mockResolvedValue({
      user: {
        uid: "u-2",
        email: "new@example.com",
        emailVerified: false,
      },
    });

    const result = await registerWithEmailAndPassword({
      email: "new@example.com",
      password: "password",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        uid: "u-2",
        email: "new@example.com",
        emailVerified: false,
      },
    });
  });

  test("ログインユーザーなしで verify メール送信すると unauthenticated を返す", async () => {
    getFirebaseAuthMock.mockReturnValue({ currentUser: null });

    const result = await sendVerificationEmailForCurrentUser();

    expect(result).toEqual({
      ok: false,
      error: {
        code: "unauthenticated",
        message: "ログイン中のユーザーが見つかりません。",
        firebaseCode: null,
      },
    });
    expect(sendEmailVerificationMock).not.toHaveBeenCalled();
  });

  test("reloadCurrentAuthUser 成功時は最新ユーザーを返す", async () => {
    const currentUser = {
      uid: "u-3",
      email: "verify@example.com",
      emailVerified: true,
    };
    getFirebaseAuthMock.mockReturnValue({ currentUser });
    reloadMock.mockResolvedValue(undefined);

    const result = await reloadCurrentAuthUser();

    expect(reloadMock).toHaveBeenCalledWith(currentUser);
    expect(result).toEqual({
      ok: true,
      data: {
        uid: "u-3",
        email: "verify@example.com",
        emailVerified: true,
      },
    });
  });

  test("password reset 失敗時もエラーコードを保持する", async () => {
    getFirebaseAuthMock.mockReturnValue({ currentUser: null });
    sendPasswordResetEmailMock.mockRejectedValue({
      code: "auth/user-not-found",
      message: "user not found",
    });

    const result = await sendPasswordResetEmailByAddress({
      email: "missing@example.com",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "user-not-found",
        message: "user not found",
        firebaseCode: "user-not-found",
      },
    });
  });
});
