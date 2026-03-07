import type { AuthActionError } from "@/entities";
import { describe, expect, test } from "vitest";
import {
  getGoogleSignInErrorMessage,
  getLoginErrorMessage,
  getPrincipalProvisionErrorMessage,
  getRegisterErrorMessage,
  getVerifyEmailErrorMessage,
  PASSWORD_RESET_COMPLETION_MESSAGE,
  PASSWORD_RESET_RETRY_GUIDANCE_MESSAGE,
} from "./error-message";

function createError(code: AuthActionError["code"]): AuthActionError {
  return {
    code,
    message: "firebase message",
    firebaseCode: null,
  };
}

describe("auth flow error message", () => {
  test("login の invalid-credentials を統一文言へ変換する", () => {
    const message = getLoginErrorMessage(createError("invalid-credentials"));
    expect(message).toBe("メールアドレスまたはパスワードが正しくありません。");
  });

  test("register の email-already-in-use を専用文言へ変換する", () => {
    const message = getRegisterErrorMessage(createError("email-already-in-use"));
    expect(message).toBe("このメールアドレスは既に使用されています。");
  });

  test("verify の unauthenticated をログイン要求文言へ変換する", () => {
    const message = getVerifyEmailErrorMessage(createError("unauthenticated"));
    expect(message).toBe("確認メールを再送するにはログインが必要です。");
  });

  test("google sign-in の popup-closed-by-user をキャンセル文言へ変換する", () => {
    const message = getGoogleSignInErrorMessage(createError("popup-closed-by-user"));
    expect(message).toBe("Googleサインインをキャンセルしました。");
  });

  test("google sign-in の popup-blocked をブロック文言へ変換する", () => {
    const message = getGoogleSignInErrorMessage(createError("popup-blocked"));
    expect(message).toBe(
      "ポップアップがブロックされました。ブラウザ設定を確認して再試行してください。",
    );
  });

  test("principal確保の auth-unavailable を運用向け文言へ変換する", () => {
    const message = getPrincipalProvisionErrorMessage({
      code: "auth-unavailable",
      message: "authentication dependency is unavailable",
      backendCode: "AUTH_UNAVAILABLE",
      requestId: "req-123",
      status: 503,
    });
    expect(message).toContain("認証基盤が一時的に利用できません");
    expect(message).toContain("req-123");
  });

  test("principal確保の network-request-failed は接続確認文言を返す", () => {
    const message = getPrincipalProvisionErrorMessage({
      code: "network-request-failed",
      message: "network error",
      backendCode: null,
      requestId: null,
      status: null,
    });
    expect(message).toBe("ネットワークエラーが発生しました。接続を確認して再試行してください。");
  });

  test("principal確保の token-unavailable は再ログイン文言を返す", () => {
    const message = getPrincipalProvisionErrorMessage({
      code: "token-unavailable",
      message: "token unavailable",
      backendCode: null,
      requestId: null,
      status: null,
    });
    expect(message).toBe("セッションが無効です。再度ログインしてください。");
  });

  test("password reset の完了メッセージを固定化する", () => {
    expect(PASSWORD_RESET_COMPLETION_MESSAGE).toBe(
      "メールアドレスが登録されている場合、パスワード再設定メールを送信しました。",
    );
  });

  test("password reset の再試行導線文言を固定化する", () => {
    expect(PASSWORD_RESET_RETRY_GUIDANCE_MESSAGE).toBe(
      "メールが届かない場合は、迷惑メールフォルダを確認し、少し待ってからもう一度送信してください。",
    );
  });
});
