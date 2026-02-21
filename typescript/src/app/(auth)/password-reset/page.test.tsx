import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import PasswordResetPage from "./page";

type SearchParams = Record<string, string | string[] | undefined>;

async function renderPasswordResetPage(searchParams: SearchParams = {}): Promise<string> {
  const page = await PasswordResetPage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(page);
}

describe("Password reset request page", () => {
  test("デフォルトで再設定申請UIとログイン導線を表示する", async () => {
    const html = await renderPasswordResetPage();

    expect(html).toContain("再設定申請");
    expect(html).toContain("パスワード再設定メールを送信します");
    expect(html).toContain("href=\"/password-reset?state=sent\"");
    expect(html).toContain("href=\"/login\"");
  });

  test("state=sent で送信完了表示を出す", async () => {
    const html = await renderPasswordResetPage({ state: "sent" });

    expect(html).toContain("送信完了");
    expect(html).toContain("data-testid=\"password-reset-request-notice-sent\"");
    expect(html).toContain("再設定メールを送信しました。");
  });

  test("state=error で送信失敗表示を出す", async () => {
    const html = await renderPasswordResetPage({ state: "error" });

    expect(html).toContain("送信失敗");
    expect(html).toContain("data-testid=\"password-reset-request-notice-error\"");
    expect(html).toContain("href=\"/password-reset\"");
  });

  test("未知のstateは default にフォールバックする", async () => {
    const html = await renderPasswordResetPage({ state: "unexpected" });

    expect(html).toContain("再設定申請");
    expect(html).not.toContain("送信失敗");
  });
});
