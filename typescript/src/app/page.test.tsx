import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

describe("Home page", () => {
  test("FSDのPublic API経由で描画できる", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("LinkLynx");
    expect(html).toContain("FSD Public API Sandbox");
    expect(html).toContain("v1 UIスライスの雛形");
  });
});
