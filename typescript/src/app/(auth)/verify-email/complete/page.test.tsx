import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import VerifyEmailCompletePage from "./page";

type SearchParams = Record<string, string | string[] | undefined>;

async function renderVerifyEmailCompletePage(searchParams: SearchParams = {}): Promise<string> {
  const page = await VerifyEmailCompletePage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(page);
}

describe("Verify email complete page", () => {
  test("デフォルトで確認完了とログイン導線を表示する", async () => {
    const html = await renderVerifyEmailCompletePage();

    expect(html).toContain("確認完了");
    expect(html).toContain("メール確認が完了しました");
    expect(html).toContain("href=\"/login\"");
    expect(html).toContain("href=\"/verify-email\"");
  });

  test("state=already-verified で確認済み表示を出す", async () => {
    const html = await renderVerifyEmailCompletePage({ state: "already-verified" });

    expect(html).toContain("確認済み");
    expect(html).toContain("このメールはすでに確認済みです");
  });

  test("未知のstateは success にフォールバックする", async () => {
    const html = await renderVerifyEmailCompletePage({ state: "unexpected" });

    expect(html).toContain("確認完了");
    expect(html).not.toContain("このメールはすでに確認済みです");
  });
});
