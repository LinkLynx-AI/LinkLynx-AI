import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import LoginPage from "./page";

type SearchParams = Record<string, string | string[] | undefined>;

async function renderLoginPage(searchParams: SearchParams = {}): Promise<string> {
  const page = await LoginPage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(page);
}

describe("Login page", () => {
  test("デフォルトで主要CTAと導線を表示する", async () => {
    const html = await renderLoginPage();

    expect(html).toContain("おかえりなさい");
    expect(html).toContain("ログイン");
    expect(html).toContain("href=\"/password-reset\"");
    expect(html).toContain("href=\"/register\"");
  });

  test("state=form-error でglobal errorを表示する", async () => {
    const html = await renderLoginPage({ state: "form-error" });

    expect(html).toContain("data-testid=\"auth-global-error\"");
    expect(html).toContain("メールアドレスまたはパスワードが正しくありません。");
  });

  test("state=field-error でfield errorを表示する", async () => {
    const html = await renderLoginPage({ state: "field-error" });

    expect(html).toContain("data-testid=\"auth-field-error-password\"");
    expect(html).toContain("パスワードを入力してください。");
  });

  test("state=disabled で入力とボタンが無効になる", async () => {
    const html = await renderLoginPage({ state: "disabled" });

    expect(html).toContain("disabled=\"\"");
  });

  test("state=loading で送信中表示になる", async () => {
    const html = await renderLoginPage({ state: "loading" });

    expect(html).toContain("ログイン中...");
    expect(html).toContain("aria-busy=\"true\"");
  });
});
