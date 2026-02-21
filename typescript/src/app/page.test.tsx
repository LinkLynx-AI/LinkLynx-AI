import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

describe("Home page", () => {
  test("メッセージ一覧とグルーピングUIを描画できる", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("LinkLynx");
    expect(html).toContain("メッセージ一覧");
    expect(html).toContain("同一送信者の5分以内連投は同じグループで表示します。");
  });
});
