/** @vitest-environment happy-dom */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Toast, getDuration } from "./Toast";

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("variant ごとのスタイルを適用する", () => {
    render(<Toast title="Error" variant="error" />);

    const toastTitle = screen.getByText("Error");
    const toast = toastTitle.closest("[role='status']");

    expect(toast).not.toBeNull();
    expect(toast?.className).toContain("border-discord-red");
  });

  test("閉じるボタン押下で onClose を呼ぶ", () => {
    const onClose = vi.fn();

    render(<Toast title="Saved" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "トーストを閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("autoCloseMs から duration を計算する", () => {
    expect(getDuration(500)).toBe(500);
    expect(getDuration(0)).toBe(Number.POSITIVE_INFINITY);
    expect(getDuration()).toBe(Number.POSITIVE_INFINITY);
  });
});
