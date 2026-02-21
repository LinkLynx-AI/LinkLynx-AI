import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import RegisterPage from "./page";

type SearchParams = Record<string, string | string[] | undefined>;

async function renderRegisterPage(searchParams: SearchParams = {}): Promise<string> {
  const page = await RegisterPage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(page);
}

describe("Register page", () => {
  test("デフォルトで主要CTAとログイン導線を表示する", async () => {
    const html = await renderRegisterPage();

    expect(html).toContain("LinkLynxへようこそ");
    expect(html).toContain("アカウントを作成");
    expect(html).toContain("href=\"/login\"");
  });

  test("state=form-error でglobal errorを表示する", async () => {
    const html = await renderRegisterPage({ state: "form-error" });

    expect(html).toContain("data-testid=\"auth-global-error\"");
    expect(html).toContain("現在、新規登録は一時停止しています。");
  });

  test("state=field-error でfield errorを表示する", async () => {
    const html = await renderRegisterPage({ state: "field-error" });

    expect(html).toContain("data-testid=\"auth-field-error-confirmPassword\"");
    expect(html).toContain("確認用パスワードが一致しません。");
  });

  test("state=disabled で入力とボタンが無効になる", async () => {
    const html = await renderRegisterPage({ state: "disabled" });

    expect(html).toContain("disabled=\"\"");
  });

  test("state=loading で送信中表示になる", async () => {
    const html = await renderRegisterPage({ state: "loading" });

    expect(html).toContain("作成中...");
    expect(html).toContain("aria-busy=\"true\"");
  });
});
