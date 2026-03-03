import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirebaseAuth } from "@/shared/lib";
import type { AuthActionError, AuthActionErrorCode, AuthActionResult, AuthUser } from "../model";
import { createManualAuthActionError, toAuthUser } from "../model";

const FIREBASE_ERROR_CODE_MAP: Readonly<Record<string, AuthActionErrorCode>> = {
  "invalid-credential": "invalid-credentials",
  "wrong-password": "invalid-credentials",
  "invalid-email": "invalid-email",
  "email-already-in-use": "email-already-in-use",
  "weak-password": "weak-password",
  "user-not-found": "user-not-found",
  "too-many-requests": "too-many-requests",
  "network-request-failed": "network-request-failed",
  "operation-not-allowed": "operation-not-allowed",
  "requires-recent-login": "requires-recent-login",
};

type FirebaseErrorLike = {
  code: string;
  message?: string;
};

function isFirebaseErrorLike(error: unknown): error is FirebaseErrorLike {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as Record<string, unknown>;
  return typeof candidate.code === "string";
}

function normalizeFirebaseCode(rawCode: string): string {
  return rawCode.startsWith("auth/") ? rawCode.slice("auth/".length) : rawCode;
}

function toAuthActionError(error: unknown, fallbackMessage: string): AuthActionError {
  if (!isFirebaseErrorLike(error)) {
    return createManualAuthActionError({
      code: "unknown",
      message: fallbackMessage,
      firebaseCode: null,
    });
  }

  const firebaseCode = normalizeFirebaseCode(error.code);
  return createManualAuthActionError({
    code: FIREBASE_ERROR_CODE_MAP[firebaseCode] ?? "unknown",
    message: error.message ?? fallbackMessage,
    firebaseCode,
  });
}

function toFailure<T>(error: unknown, fallbackMessage: string): AuthActionResult<T> {
  return {
    ok: false,
    error: toAuthActionError(error, fallbackMessage),
  };
}

function toUnauthenticatedFailure<T>(message: string): AuthActionResult<T> {
  return {
    ok: false,
    error: createManualAuthActionError({
      code: "unauthenticated",
      message,
      firebaseCode: null,
    }),
  };
}

/**
 * メールアドレスとパスワードでログインする。
 */
export async function loginWithEmailAndPassword(params: {
  email: string;
  password: string;
}): Promise<AuthActionResult<AuthUser>> {
  try {
    const credential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      params.email,
      params.password,
    );

    return {
      ok: true,
      data: toAuthUser(credential.user),
    };
  } catch (error: unknown) {
    return toFailure(error, "ログインに失敗しました。");
  }
}

/**
 * メールアドレスとパスワードで新規登録する。
 */
export async function registerWithEmailAndPassword(params: {
  email: string;
  password: string;
}): Promise<AuthActionResult<AuthUser>> {
  try {
    const credential = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      params.email,
      params.password,
    );

    return {
      ok: true,
      data: toAuthUser(credential.user),
    };
  } catch (error: unknown) {
    return toFailure(error, "新規登録に失敗しました。");
  }
}

/**
 * 現在ログイン中ユーザーへ確認メールを送信する。
 */
export async function sendVerificationEmailForCurrentUser(): Promise<AuthActionResult<null>> {
  const currentUser = getFirebaseAuth().currentUser;
  if (currentUser === null) {
    return toUnauthenticatedFailure("ログイン中のユーザーが見つかりません。");
  }

  try {
    await sendEmailVerification(currentUser);
    return { ok: true, data: null };
  } catch (error: unknown) {
    return toFailure(error, "確認メールの送信に失敗しました。");
  }
}

/**
 * 現在ログイン中ユーザーの認証情報を再取得する。
 */
export async function reloadCurrentAuthUser(): Promise<AuthActionResult<AuthUser>> {
  const currentUser = getFirebaseAuth().currentUser;
  if (currentUser === null) {
    return toUnauthenticatedFailure("ログイン中のユーザーが見つかりません。");
  }

  try {
    await reload(currentUser);
    return {
      ok: true,
      data: toAuthUser(currentUser),
    };
  } catch (error: unknown) {
    return toFailure(error, "ユーザー情報の更新に失敗しました。");
  }
}

/**
 * 指定メールアドレスにパスワード再設定メールを送信する。
 */
export async function sendPasswordResetEmailByAddress(params: {
  email: string;
}): Promise<AuthActionResult<null>> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), params.email);
    return { ok: true, data: null };
  } catch (error: unknown) {
    return toFailure(error, "パスワード再設定メールの送信に失敗しました。");
  }
}
