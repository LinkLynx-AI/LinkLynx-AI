import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

describe("Home page", () => {
  test("メッセージ一覧とComposer UIを描画できる", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("LinkLynx");
    expect(html).toContain("メッセージ一覧");
    expect(html).toContain("同一送信者の5分以内連投は同じグループで表示します。");
    expect(html).toContain("Composer UI Demo");
    expect(html).toContain("入力モード: 通常入力");
    expect(html).toContain("Enterで送信 / Shift+Enterで改行");
    expect(html).toContain("直近の送信内容（UI only）: 未送信");
  });
});
