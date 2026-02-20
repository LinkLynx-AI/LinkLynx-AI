/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Toast } from "./Toast";

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("variant ごとのスタイルを適用する", () => {
    render(<Toast title="Error" variant="error" />);

    const toast = screen.getByRole("status");
    expect(toast.className).toContain("border-discord-red");
  });

  test("閉じるボタン押下で onClose を呼ぶ", () => {
    const onClose = vi.fn();

    render(<Toast title="Saved" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "トーストを閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("autoCloseMs 指定時に自動で onClose を呼ぶ", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(<Toast title="Saved" onClose={onClose} autoCloseMs={500} />);

    vi.advanceTimersByTime(500);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
