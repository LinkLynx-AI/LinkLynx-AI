import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import VerifyEmailPage from "./page";

type SearchParams = Record<string, string | string[] | undefined>;

async function renderVerifyEmailPage(searchParams: SearchParams = {}): Promise<string> {
  const page = await VerifyEmailPage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(page);
}

describe("Verify email page", () => {
  test("デフォルトで確認待ちと次アクション導線を表示する", async () => {
    const html = await renderVerifyEmailPage();

    expect(html).toContain("確認待ち");
    expect(html).toContain("確認メールを送信しました");
    expect(html).toContain("href=\"/verify-email?state=resent\"");
    expect(html).toContain("href=\"/login\"");
  });

  test("state=resent で再送完了表示を出す", async () => {
    const html = await renderVerifyEmailPage({ state: "resent" });

    expect(html).toContain("再送完了");
    expect(html).toContain("data-testid=\"verify-email-notice-resent\"");
    expect(html).toContain("確認メールを再送しました。");
  });

  test("state=resend-error で再送失敗表示を出す", async () => {
    const html = await renderVerifyEmailPage({ state: "resend-error" });

    expect(html).toContain("再送失敗");
    expect(html).toContain("data-testid=\"verify-email-notice-resend-error\"");
    expect(html).toContain("確認メールの再送に失敗しました。");
  });

  test("state=expired で期限切れ表示を出す", async () => {
    const html = await renderVerifyEmailPage({ state: "expired" });

    expect(html).toContain("リンク期限切れ");
    expect(html).toContain("確認リンクの有効期限が切れています");
    expect(html).toContain("data-testid=\"verify-email-notice-expired\"");
  });

  test("未知のstateは waiting にフォールバックする", async () => {
    const html = await renderVerifyEmailPage({ state: "unexpected" });

    expect(html).toContain("確認待ち");
    expect(html).not.toContain("再送失敗");
  });
});
