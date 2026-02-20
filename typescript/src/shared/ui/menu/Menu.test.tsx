/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Menu } from "./Menu";

describe("Menu", () => {
  test("menuitem を表示しクリック時にハンドラーを呼ぶ", () => {
    const onEdit = vi.fn();

    render(
      <Menu
        label="actions"
        items={[
          { id: "edit", label: "Edit", onClick: onEdit },
          { id: "disabled", label: "Disabled", disabled: true },
          { id: "delete", label: "Delete", destructive: true },
        ]}
      />
    );

    const menu = screen.getByRole("menu", { name: "actions" });
    expect(menu).toBeTruthy();

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(3);

    fireEvent.click(items[0]);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  test("Arrow/Home/End キーで有効項目へフォーカス移動する", () => {
    render(
      <Menu
        label="actions"
        items={[
          { id: "edit", label: "Edit" },
          { id: "disabled", label: "Disabled", disabled: true },
          { id: "delete", label: "Delete" },
        ]}
      />
    );

    const menu = screen.getByRole("menu", { name: "actions" });
    const [editButton, , deleteButton] = screen.getAllByRole("menuitem");

    editButton.focus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(deleteButton);

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(editButton);

    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(deleteButton);

    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(editButton);
  });
});
