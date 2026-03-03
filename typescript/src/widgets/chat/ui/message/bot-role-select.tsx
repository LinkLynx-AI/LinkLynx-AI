"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import type { RoleSelectComponent } from "@/shared/model/legacy/types/bot-components";

type MockRole = {
  id: string;
  name: string;
  color: string;
};

const mockRoles: MockRole[] = [];

export function BotRoleSelect({
  component,
  onSelect,
}: {
  component: RoleSelectComponent;
  onSelect?: (customId: string, roleIds: string[]) => void;
}) {
  const maxValues = component.maxValues ?? 1;
  const isMulti = maxValues > 1;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleRoleClick = (roleId: string) => {
    if (component.disabled) return;

    if (isMulti) {
      const newSelected = selected.includes(roleId)
        ? selected.filter((id) => id !== roleId)
        : selected.length < maxValues
          ? [...selected, roleId]
          : selected;
      setSelected(newSelected);
      onSelect?.(component.customId, newSelected);
    } else {
      setSelected([roleId]);
      setOpen(false);
      onSelect?.(component.customId, [roleId]);
    }
  };

  const displayLabel = () => {
    if (selected.length === 0) {
      return component.placeholder ?? "ロールを選択";
    }
    const names = selected.map((id) => mockRoles.find((r) => r.id === id)?.name).filter(Boolean);
    return names.join(", ");
  };

  return (
    <div ref={ref} className="relative max-w-[400px]">
      <button
        onClick={() => !component.disabled && setOpen(!open)}
        disabled={component.disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-[3px] bg-discord-input-bg px-3 py-2 text-sm transition-colors",
          selected.length > 0 ? "text-discord-text-normal" : "text-discord-text-muted",
          component.disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="truncate">{displayLabel()}</span>
        <div className="flex items-center gap-1.5">
          {isMulti && selected.length > 0 && (
            <span className="text-xs text-discord-text-muted">
              {selected.length}/{maxValues}
            </span>
          )}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={cn("shrink-0 transition-transform", open && "rotate-180")}
          >
            <path d="M7 10l5 5 5-5H7z" />
          </svg>
        </div>
      </button>
      {open && (
        <div
          className="absolute top-full z-50 mt-1 w-full overflow-y-auto rounded bg-discord-bg-floating py-1 shadow-xl"
          style={{ maxHeight: 256 }}
          role="listbox"
        >
          {mockRoles.map((role) => {
            const isSelected = selected.includes(role.id);
            return (
              <button
                key={role.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleRoleClick(role.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                  "text-discord-text-normal hover:bg-discord-brand-blurple hover:text-white",
                  isSelected && "bg-discord-bg-mod-selected",
                )}
              >
                {isMulti && (
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                      isSelected
                        ? "border-discord-brand-blurple bg-discord-brand-blurple"
                        : "border-discord-text-muted",
                    )}
                  >
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                  </span>
                )}
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: role.color }}
                />
                <span>{role.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
