import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import PasswordResetCompletePage from "./page";

type SearchParams = Record<string, string | string[] | undefined>;

async function renderPasswordResetCompletePage(searchParams: SearchParams = {}): Promise<string> {
  const page = await PasswordResetCompletePage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(page);
}

describe("Password reset complete page", () => {
  test("完了状態を表示しログイン導線を出す", async () => {
    const html = await renderPasswordResetCompletePage();

    expect(html).toContain("更新完了");
    expect(html).toContain("パスワードの更新が完了しました");
    expect(html).toContain("href=\"/login\"");
    expect(html).toContain("href=\"/password-reset\"");
  });

  test("state=success を受け取っても同じ完了表示を維持する", async () => {
    const html = await renderPasswordResetCompletePage({ state: "success" });

    expect(html).toContain("更新完了");
  });

  test("未知のstateは success にフォールバックする", async () => {
    const html = await renderPasswordResetCompletePage({ state: "unexpected" });

    expect(html).toContain("更新完了");
  });
});
