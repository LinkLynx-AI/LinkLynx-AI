// @vitest-environment jsdom
import type { AuthActionResult } from "@/entities";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const sendPasswordResetEmailByAddressMock = vi.hoisted(() =>
  vi.fn<(params: { email: string }) => Promise<AuthActionResult<null>>>(),
);

vi.mock("@/entities", () => ({
  sendPasswordResetEmailByAddress: sendPasswordResetEmailByAddressMock,
}));

import { PasswordResetForm } from "./password-reset-form";

describe("PasswordResetForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("email 未入力ならバリデーションエラーを表示する", async () => {
    render(<PasswordResetForm />);

    await userEvent.click(screen.getByRole("button", { name: "再設定メールを送る" }));

    expect(screen.getByText("メールアドレスを入力してください。")).toBeTruthy();
    expect(sendPasswordResetEmailByAddressMock).not.toHaveBeenCalled();
  });

  test("送信成功後は完了メッセージと再試行導線を表示する", async () => {
    sendPasswordResetEmailByAddressMock.mockResolvedValue({
      ok: true,
      data: null,
    });

    render(<PasswordResetForm />);

    await userEvent.type(screen.getByRole("textbox"), "reset@example.com");
    await userEvent.click(screen.getByRole("button", { name: "再設定メールを送る" }));

    expect(sendPasswordResetEmailByAddressMock).toHaveBeenCalledWith({
      email: "reset@example.com",
    });
    expect(
      screen.getByText(
        "メールアドレスが登録されている場合、パスワード再設定メールを送信しました。",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "メールが届かない場合は、迷惑メールフォルダを確認し、少し待ってからもう一度送信してください。",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "もう一度送る" })).toBeTruthy();
  });

  test("送信失敗時も列挙防止文言を保ちつつ再試行できる", async () => {
    sendPasswordResetEmailByAddressMock
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "network-request-failed",
          message: "network error",
          firebaseCode: "network-request-failed",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: null,
      });

    render(<PasswordResetForm />);

    await userEvent.type(screen.getByRole("textbox"), "reset@example.com");
    await userEvent.click(screen.getByRole("button", { name: "再設定メールを送る" }));

    expect(
      screen.getByText(
        "メールアドレスが登録されている場合、パスワード再設定メールを送信しました。",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "メールが届かない場合は、迷惑メールフォルダを確認し、少し待ってからもう一度送信してください。",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("network error")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "もう一度送る" }));

    expect(sendPasswordResetEmailByAddressMock).toHaveBeenCalledTimes(2);
  });
});
