import type { AuthActionError } from "@/entities";
import { describe, expect, test } from "vitest";
import {
  getLoginErrorMessage,
  getPrincipalProvisionErrorMessage,
  getRegisterErrorMessage,
  getVerifyEmailErrorMessage,
  PASSWORD_RESET_COMPLETION_MESSAGE,
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

  test("password reset の完了メッセージを固定化する", () => {
    expect(PASSWORD_RESET_COMPLETION_MESSAGE).toBe(
      "メールアドレスが登録されている場合、パスワード再設定メールを送信しました。",
    );
  });
});
