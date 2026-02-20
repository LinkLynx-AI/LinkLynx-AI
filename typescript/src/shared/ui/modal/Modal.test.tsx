/** @vitest-environment happy-dom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  test("open=false では描画しない", () => {
    render(<Modal open={false} title="Modal" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Escape キーで onClose を呼ぶ", () => {
    const onClose = vi.fn();

    render(
      <Modal open title="Delete message" description="Delete description" onClose={onClose}>
        content
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("閉じるボタンで onClose を呼ぶ", () => {
    const onClose = vi.fn();

    render(
      <Modal open title="Delete message" description="Delete description" onClose={onClose}>
        content
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Tab/Shift+Tab でフォーカスをダイアログ内に維持する", async () => {
    render(
      <Modal
        open
        title="Focus trap"
        description="Focus trap description"
        onClose={() => undefined}
        actions={
          <>
            <button type="button">Cancel</button>
            <button type="button">Confirm</button>
          </>
        }
      />,
    );

    const closeButton = screen.getByRole("button", { name: "閉じる" });
    const modalElement = screen.getByRole("dialog");

    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    fireEvent.keyDown(document, { key: "Tab" });
    expect(modalElement.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(modalElement.contains(document.activeElement)).toBe(true);
  });
});
