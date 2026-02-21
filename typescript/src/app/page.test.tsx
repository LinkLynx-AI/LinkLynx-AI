import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

describe("Home page", () => {
  test("FSDのPublic API経由で描画できる", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("LinkLynx");
    expect(html).toContain("FSD Public API Sandbox");
    expect(html).toContain("v1 UIスライスの雛形");
    expect(html).toContain("Composer UI Demo");
    expect(html).toContain("入力モード: 通常入力");
    expect(html).toContain("Enterで送信 / Shift+Enterで改行");
    expect(html).toContain("直近の送信内容（UI only）: 未送信");
  });
});
