import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProtectedPreviewGate } from "./protected-preview-gate";

describe("ProtectedPreviewGate", () => {
  test("guard が未指定なら子要素を描画する", () => {
    const html = renderToStaticMarkup(
      <ProtectedPreviewGate guard={null}>
        <p>protected content</p>
      </ProtectedPreviewGate>,
    );

    expect(html).toContain("protected content");
  });

  test("guard が指定されるとガード画面を描画する", () => {
    const html = renderToStaticMarkup(
      <ProtectedPreviewGate guard="forbidden">
        <p>protected content</p>
      </ProtectedPreviewGate>,
    );

    expect(html).toContain("アクセス権限がありません");
    expect(html).not.toContain("protected content");
  });
});
