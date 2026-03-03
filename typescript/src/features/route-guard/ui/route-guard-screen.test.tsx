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

  test("未ログインガードのログインリンクを上書きできる", () => {
    const html = renderToStaticMarkup(
      <RouteGuardScreen
        kind="unauthenticated"
        loginHref="/login?returnTo=%2Fchannels%2Fme&reason=session-expired"
      />,
    );

    expect(html).toContain('href="/login?returnTo=%2Fchannels%2Fme&amp;reason=session-expired"');
  });

  test("権限不足ガードを描画する", () => {
    const html = renderToStaticMarkup(<RouteGuardScreen kind="forbidden" />);

    expect(html).toContain("アクセス権限がありません");
    expect(html).toContain('href="/channels/me"');
  });

  test("not-found ガードを描画する", () => {
    const html = renderToStaticMarkup(<RouteGuardScreen kind="not-found" />);

    expect(html).toContain("対象が見つかりません");
    expect(html).toContain('href="/"');
  });

  test("service-unavailable ガードを描画する", () => {
    const html = renderToStaticMarkup(<RouteGuardScreen kind="service-unavailable" />);

    expect(html).toContain("認証基盤が一時的に利用できません");
    expect(html).toContain('href="/login"');
  });
});
