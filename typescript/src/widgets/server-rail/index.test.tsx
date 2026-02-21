/** @vitest-environment happy-dom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ServerRail } from "./index";

describe("ServerRail", () => {
  test("選択/ホバー/未読/メンション状態の class を描画へ反映する", () => {
    render(
      <ServerRail
        items={[
          { id: "selected", label: "Selected", isSelected: true },
          { id: "hovered", label: "Hovered", isHovered: true },
          { id: "unread", label: "Unread", hasUnread: true, mentionCount: 3 },
        ]}
      />
    );

    const selectedItem = screen.getByTestId("server-rail-item-selected");
    const selectedIndicator = screen.getByTestId("server-rail-indicator-selected");
    expect(selectedItem.className).toContain("bg-discord-primary");
    expect(selectedIndicator.className).toContain("h-10");

    const hoveredItem = screen.getByTestId("server-rail-item-hovered");
    const hoveredIndicator = screen.getByTestId("server-rail-indicator-hovered");
    expect(hoveredItem.className).toContain("bg-discord-darker");
    expect(hoveredIndicator.className).toContain("h-5");

    const unreadIndicator = screen.getByTestId("server-rail-indicator-unread");
    const mentionBadge = screen.getByTestId("server-rail-mention-unread");
    expect(unreadIndicator.className).toContain("h-2");
    expect(mentionBadge.textContent).toBe("3");
  });

  test("クリック時に item id を onSelect へ渡す", () => {
    const onSelect = vi.fn();

    render(<ServerRail items={[{ id: "alpha", label: "Alpha", onSelect }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  test("mentionCount が 100 以上なら 99+ を表示する", () => {
    render(
      <ServerRail items={[{ id: "count", label: "Count", mentionCount: 120 }]} />
    );

    const mentionBadge = screen.getByTestId("server-rail-mention-count");
    expect(mentionBadge.textContent).toBe("99+");
  });

  test("mentionCount が 0 以下ならメンションバッジを表示しない", () => {
    render(
      <ServerRail items={[{ id: "silent", label: "Silent", mentionCount: -2 }]} />
    );

    expect(screen.queryByTestId("server-rail-mention-silent")).toBeNull();
  });
});
