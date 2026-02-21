import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import PasswordResetTokenPage from "./page";

type SearchParams = Record<string, string | string[] | undefined>;

type RenderOptions = {
  token?: string;
  searchParams?: SearchParams;
};

async function renderPasswordResetTokenPage(options: RenderOptions = {}): Promise<string> {
  const token = options.token ?? "sample-token";
  const searchParams = options.searchParams ?? {};
  const page = await PasswordResetTokenPage({
    params: Promise.resolve({ token }),
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(page);
}

describe("Password reset token page", () => {
  test("デフォルトで再設定入力UIを表示する", async () => {
    const html = await renderPasswordResetTokenPage();

    expect(html).toContain("新しいパスワード設定");
    expect(html).toContain("新しいパスワードを設定してください");
    expect(html).toContain("href=\"/password-reset/sample-token?state=submitting\"");
    expect(html).toContain("href=\"/login\"");
  });

  test("state=invalid で再申請導線を表示する", async () => {
    const html = await renderPasswordResetTokenPage({ searchParams: { state: "invalid" } });

    expect(html).toContain("リンク無効");
    expect(html).toContain("data-testid=\"password-reset-token-notice-invalid\"");
    expect(html).toContain("href=\"/password-reset\"");
  });

  test("state=expired で再申請導線を表示する", async () => {
    const html = await renderPasswordResetTokenPage({ searchParams: { state: "expired" } });

    expect(html).toContain("リンク期限切れ");
    expect(html).toContain("data-testid=\"password-reset-token-notice-expired\"");
    expect(html).toContain("href=\"/password-reset\"");
  });

  test("state=mismatch で不一致表示を出す", async () => {
    const html = await renderPasswordResetTokenPage({ searchParams: { state: "mismatch" } });

    expect(html).toContain("入力不一致");
    expect(html).toContain("data-testid=\"password-reset-token-notice-mismatch\"");
    expect(html).toContain("href=\"/password-reset/sample-token\"");
  });

  test("未知のstateは default にフォールバックする", async () => {
    const html = await renderPasswordResetTokenPage({ searchParams: { state: "unexpected" } });

    expect(html).toContain("新しいパスワード設定");
    expect(html).not.toContain("リンク無効");
  });
});
