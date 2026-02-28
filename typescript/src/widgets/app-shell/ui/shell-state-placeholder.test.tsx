import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ShellStatePlaceholder } from "./shell-state-placeholder";

describe("ShellStatePlaceholder", () => {
  test("loading 状態を描画する", () => {
    const html = renderToStaticMarkup(<ShellStatePlaceholder state="loading" />);

    expect(html).toContain("Loading");
    expect(html).toContain("データを読み込み中です");
  });

  test("error 状態を描画する", () => {
    const html = renderToStaticMarkup(<ShellStatePlaceholder state="error" />);

    expect(html).toContain("Error");
    expect(html).toContain("表示に失敗しました");
  });
});
