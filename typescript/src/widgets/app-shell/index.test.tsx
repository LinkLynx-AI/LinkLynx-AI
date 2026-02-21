/** @vitest-environment happy-dom */

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AppShellFrame } from "./index";

describe("AppShellFrame", () => {
  test("デフォルトでは3カラム構造を描画し、右パネルを表示しない", () => {
    render(
      <AppShellFrame
        serverRailSlot={<div>server rail</div>}
        listSlot={<div>list</div>}
        mainSlot={<div>main</div>}
      />,
    );

    const grid = screen.getByTestId("app-shell-grid");

    expect(grid.className).toContain("grid-cols-[72px_280px_minmax(0,1fr)]");
    expect(screen.getByRole("navigation", { name: "app-shell-server-rail" })).toBeTruthy();
    expect(screen.getByLabelText("app-shell-list")).toBeTruthy();
    expect(screen.getByRole("main", { name: "app-shell-main" })).toBeTruthy();
    expect(screen.queryByLabelText("app-shell-header")).toBeNull();
    expect(screen.queryByLabelText("app-shell-right-panel")).toBeNull();
  });

  test("右パネルを開いたときに4カラム構造と右パネルを描画する", () => {
    render(
      <AppShellFrame
        headerSlot={<div>header</div>}
        serverRailSlot={<div>server rail</div>}
        listSlot={<div>list</div>}
        mainSlot={<div>main</div>}
        isRightPanelOpen
        rightPanelSlot={<div>right panel</div>}
      />,
    );

    const grid = screen.getByTestId("app-shell-grid");

    expect(grid.className).toContain("grid-cols-[72px_280px_minmax(0,1fr)_320px]");
    expect(screen.getByLabelText("app-shell-header")).toBeTruthy();
    expect(screen.getByLabelText("app-shell-right-panel")).toBeTruthy();
  });
});
