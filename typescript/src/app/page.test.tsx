import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

describe("Home page", () => {
  test("ライト/ダークのテーマトークンを表示する", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("Theme Tokens Preview");
    expect(html).toContain("Dark theme");
    expect(html).toContain("Light theme");
    expect(html).toContain("spacing.lg");
  });
});
