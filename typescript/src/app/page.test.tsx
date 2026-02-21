/** @vitest-environment happy-dom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Home from "./page";

describe("Home page", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("retry押下で pending -> sent の遷移を表示する", () => {
    vi.useFakeTimers();
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "再送" }));
    expect(screen.getByText("送信中")).toBeDefined();
    expect(screen.queryByRole("button", { name: "再送" })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByText("送信済み")).toBeDefined();
  });

  test("isAtBottom=false かつ unreadCount>0 で新着ジャンプ導線を表示する", () => {
    render(<Home />);

    expect(screen.queryByRole("button", { name: /新着\d+件を表示/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "新着を追加" }));
    const jumpButton = screen.getByRole("button", { name: "↓ 新着1件を表示" });
    expect(jumpButton).toBeDefined();

    fireEvent.click(jumpButton);
    expect(screen.queryByRole("button", { name: /新着\d+件を表示/ })).toBeNull();
  });
});
