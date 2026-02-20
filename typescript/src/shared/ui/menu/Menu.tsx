"use client";

import { useRef, type KeyboardEvent } from "react";

export type MenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick?: () => void;
};

type MenuProps = {
  label: string;
  items: MenuItem[];
};

function findEnabledIndex(items: MenuItem[], start: number, direction: 1 | -1): number {
  const itemCount = items.length;
  for (let step = 1; step <= itemCount; step += 1) {
    const nextIndex = (start + direction * step + itemCount) % itemCount;
    if (!items[nextIndex]?.disabled) {
      return nextIndex;
    }
  }

  return -1;
}

export function Menu({ label, items }: MenuProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const firstEnabledIndex = items.findIndex((item) => !item.disabled);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (firstEnabledIndex < 0) {
      return;
    }

    const currentIndex = buttonRefs.current.findIndex(
      (button) => button === document.activeElement
    );

    const safeIndex = currentIndex >= 0 ? currentIndex : firstEnabledIndex;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = findEnabledIndex(items, safeIndex, 1);
      buttonRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const previousIndex = findEnabledIndex(items, safeIndex, -1);
      buttonRefs.current[previousIndex]?.focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      buttonRefs.current[firstEnabledIndex]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const reversed = [...items].reverse();
      const lastFromEnd = reversed.findIndex((item) => !item.disabled);
      const lastEnabledIndex =
        lastFromEnd >= 0 ? items.length - 1 - lastFromEnd : firstEnabledIndex;
      buttonRefs.current[lastEnabledIndex]?.focus();
    }
  };

  return (
    <div
      role="menu"
      aria-label={label}
      className="w-72 rounded-lg border border-white/15 bg-discord-darker p-2 shadow-lg"
      onKeyDown={handleKeyDown}
    >
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              tabIndex={
                item.disabled ? -1 : index === firstEnabledIndex ? 0 : -1
              }
              onClick={item.onClick}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                item.destructive
                  ? "text-discord-red hover:bg-discord-red/10"
                  : "text-white hover:bg-white/10"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
