/** @vitest-environment happy-dom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ChannelsMePage from "./@me/page";
import ChannelsLayout from "./layout";

describe("Channels layout", () => {
  test("アプリシェル統合と右パネル開閉を描画できる", () => {
    render(
      <ChannelsLayout me={<ChannelsMePage />}>
        <p>fallback child content</p>
      </ChannelsLayout>
    );

    expect(screen.getByRole("navigation", { name: "app-shell-server-rail" })).toBeTruthy();
    expect(screen.getByLabelText("app-shell-list")).toBeTruthy();
    expect(screen.getByLabelText("chat-header")).toBeTruthy();
    expect(screen.getByText("LIN-239: /channels/@me プレースホルダー")).toBeTruthy();
    expect(screen.getByLabelText("member-panel")).toBeTruthy();

    const toggleButton = screen.getByRole("button", { name: "メンバーパネルを開閉" });
    fireEvent.click(toggleButton);

    expect(toggleButton.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByLabelText("member-panel")).toBeNull();
  });
});
