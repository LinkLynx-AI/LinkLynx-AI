import type { AuthActionError } from "@/entities";
import { describe, expect, test } from "vitest";
import {
  getLoginErrorMessage,
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

  test("password reset の完了メッセージを固定化する", () => {
    expect(PASSWORD_RESET_COMPLETION_MESSAGE).toBe(
      "メールアドレスが登録されている場合、パスワード再設定メールを送信しました。",
    );
  });
});
