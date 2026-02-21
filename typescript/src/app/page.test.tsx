import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

describe("Home page", () => {
  test("主要テキストを表示する", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("LinkLynx");
    expect(html).toContain("Discord Clone - Real-time Chat Application");
  });
});
