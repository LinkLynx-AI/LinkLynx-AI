import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

describe("Home page", () => {
  test("共通UI部品のプレビューを表示する", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("Common UI Components Preview");
    expect(html).toContain("Action menu");
    expect(html).toContain("Delete message");
    expect(html).toContain("Skeleton");
  });
});
