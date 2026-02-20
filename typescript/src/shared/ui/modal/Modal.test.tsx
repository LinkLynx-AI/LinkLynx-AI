/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  test("open=false では描画しない", () => {
    render(<Modal open={false} title="Modal" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Escape/オーバーレイ/閉じるボタンで onClose を呼ぶ", async () => {
    const onClose = vi.fn();

    render(
      <Modal open title="Delete message" onClose={onClose}>
        content
      </Modal>
    );

    const dialog = screen.getByRole("dialog", { name: "Delete message" });
    expect(dialog).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("modal-overlay"));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onClose).toHaveBeenCalledTimes(3);

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "閉じる" }));
    });
  });

  test("Tab/Shift+Tab でフォーカスを循環させる", async () => {
    render(
      <Modal
        open
        title="Focus trap"
        onClose={() => undefined}
        actions={
          <>
            <button type="button">Cancel</button>
            <button type="button">Confirm</button>
          </>
        }
      />
    );

    const closeButton = screen.getByRole("button", { name: "閉じる" });
    const confirmButton = screen.getByRole("button", { name: "Confirm" });

    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    confirmButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirmButton);
  });
});
