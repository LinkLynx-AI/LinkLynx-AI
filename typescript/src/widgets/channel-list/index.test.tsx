/** @vitest-environment happy-dom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ChannelList } from "./index";

describe("ChannelList", () => {
  test("選択/ホバー/未読/メンション状態の class を描画へ反映する", () => {
    render(
      <ChannelList
        title="Channels"
        items={[
          { id: "selected", label: "general", isSelected: true },
          { id: "hovered", label: "random", isHovered: true },
          { id: "unread", label: "alice", kind: "dm", hasUnread: true, mentionCount: 4 },
        ]}
      />
    );

    const selectedItem = screen.getByTestId("channel-list-item-selected");
    const selectedIndicator = screen.getByTestId("channel-list-indicator-selected");
    expect(selectedItem.className).toContain("bg-white/15");
    expect(selectedIndicator.className).toContain("h-6");

    const hoveredItem = screen.getByTestId("channel-list-item-hovered");
    const hoveredIndicator = screen.getByTestId("channel-list-indicator-hovered");
    expect(hoveredItem.className).toContain("bg-white/10");
    expect(hoveredIndicator.className).toContain("h-4");

    const unreadIndicator = screen.getByTestId("channel-list-indicator-unread");
    const mentionBadge = screen.getByTestId("channel-list-mention-unread");
    const unreadPrefix = screen.getByTestId("channel-list-prefix-unread");
    expect(unreadIndicator.className).toContain("h-2");
    expect(mentionBadge.textContent).toBe("4");
    expect(unreadPrefix.textContent).toBe("@");
  });

  test("クリック時に item id を onSelect へ渡す", () => {
    const onSelect = vi.fn();

    render(
      <ChannelList items={[{ id: "alpha", label: "general", onSelect }]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "general" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  test("mentionCount が 100 以上なら 99+ を表示する", () => {
    render(
      <ChannelList items={[{ id: "count", label: "alerts", mentionCount: 130 }]} />
    );

    const mentionBadge = screen.getByTestId("channel-list-mention-count");
    expect(mentionBadge.textContent).toBe("99+");
  });

  test("mentionCount が 0 以下ならメンションバッジを表示しない", () => {
    render(
      <ChannelList items={[{ id: "silent", label: "quiet", mentionCount: -3 }]} />
    );

    expect(screen.queryByTestId("channel-list-mention-silent")).toBeNull();
  });
});
