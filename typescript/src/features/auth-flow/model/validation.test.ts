import { describe, expect, test } from "vitest";
import {
  validateLoginInput,
  validatePasswordResetInput,
  validateRegisterInput,
} from "./validation";

describe("auth flow validation", () => {
  test("login 入力の email を trim して通す", () => {
    const result = validateLoginInput({
      email: "  alice@example.com  ",
      password: "password",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        email: "alice@example.com",
        password: "password",
      },
    });
  });

  test("login 入力が不正なら失敗メッセージを返す", () => {
    const result = validateLoginInput({
      email: "invalid",
      password: "",
    });

    expect(result).toEqual({
      ok: false,
      message: "メールアドレスの形式が正しくありません。",
    });
  });

  test("register で確認用パスワード不一致を検出する", () => {
    const result = validateRegisterInput({
      email: "new@example.com",
      password: "abcdef",
      confirmPassword: "xyz",
    });

    expect(result).toEqual({
      ok: false,
      message: "確認用パスワードが一致しません。",
    });
  });

  test("password reset の email 必須を検証する", () => {
    const result = validatePasswordResetInput({
      email: "",
    });

    expect(result).toEqual({
      ok: false,
      message: "メールアドレスを入力してください。",
    });
  });
});
