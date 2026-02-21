/** @vitest-environment happy-dom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ChatHeader } from "./index";

describe("ChatHeader", () => {
  test("メンバーパネル切替状態を aria-pressed に反映する", () => {
    render(
      <ChatHeader
        isMemberPanelOpen
        onToggleMemberPanel={() => {}}
        subtitle="Channel"
        title="# design-review"
      />
    );

    const button = screen.getByRole("button", { name: "メンバーパネルを開閉" });

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("# design-review")).toBeTruthy();
    expect(screen.getByText("Channel")).toBeTruthy();
  });

  test("メンバーパネル切替ボタン押下でコールバックを呼ぶ", () => {
    const handleToggleMemberPanel = vi.fn();

    render(
      <ChatHeader
        isMemberPanelOpen={false}
        onToggleMemberPanel={handleToggleMemberPanel}
        title="DM with Design Reviewer"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "メンバーパネルを開閉" }));

    expect(handleToggleMemberPanel).toHaveBeenCalledTimes(1);
  });

  test("右パネル開閉を阻害しないレイアウトクラスを維持する", () => {
    render(
      <ChatHeader
        isMemberPanelOpen={false}
        onToggleMemberPanel={() => {}}
        title="General"
      />
    );

    const header = screen.getByTestId("chat-header");
    const button = screen.getByRole("button", { name: "メンバーパネルを開閉" });

    expect(header.className).toContain("min-w-0");
    expect(button.className).toContain("shrink-0");
    expect(button.className).toContain("transition-colors");
  });
});
