import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RouteGuardScreen } from "./route-guard-screen";

describe("RouteGuardScreen", () => {
  test("未ログインガードを描画する", () => {
    const html = renderToStaticMarkup(<RouteGuardScreen kind="unauthenticated" />);

    expect(html).toContain("ログインが必要です");
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/register"');
  });

  test("権限不足ガードを描画する", () => {
    const html = renderToStaticMarkup(<RouteGuardScreen kind="forbidden" />);

    expect(html).toContain("アクセス権限がありません");
    expect(html).toContain('href="/channels/@me"');
  });

  test("not-found ガードを描画する", () => {
    const html = renderToStaticMarkup(<RouteGuardScreen kind="not-found" />);

    expect(html).toContain("対象が見つかりません");
    expect(html).toContain('href="/"');
  });
});
