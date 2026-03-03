"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { Avatar } from "@/shared/ui/legacy/avatar";
import type { SlashCommand } from "@/shared/model/legacy/types/bot-components";
import { SlashCommandArgs } from "./slash-command-args";

export function SlashCommandPopup({
  commands,
  filter,
  onSelect,
  onClose,
}: {
  commands: SlashCommand[];
  filter: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedCommand, setSelectedCommand] = useState<SlashCommand | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter((cmd) => cmd.name.toLowerCase().includes(filter.toLowerCase()));

  const grouped = filtered.reduce<Record<string, SlashCommand[]>>((acc, cmd) => {
    const group = cmd.botName;
    if (!acc[group]) acc[group] = [];
    acc[group].push(cmd);
    return acc;
  }, {});

  const flatList = Object.values(grouped).flat();

  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  const handleSelectCommand = useCallback(
    (cmd: SlashCommand) => {
      if (cmd.options && cmd.options.length > 0) {
        setSelectedCommand(cmd);
      } else {
        onSelect(cmd);
      }
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (selectedCommand) return; // Let SlashCommandArgs handle keys
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatList.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (flatList[activeIndex]) {
          handleSelectCommand(flatList[activeIndex]);
        }
      }
    },
    [flatList, activeIndex, handleSelectCommand, onClose, selectedCommand],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const activeEl = listRef.current?.querySelector("[data-active='true']") as HTMLElement | null;
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (selectedCommand) {
    return (
      <div
        className={cn(
          "absolute bottom-full left-0 z-50 mb-1 w-full",
          "rounded-lg bg-discord-bg-floating shadow-xl",
        )}
      >
        <SlashCommandArgs
          command={selectedCommand}
          onSubmit={() => {
            onSelect(selectedCommand);
            setSelectedCommand(null);
          }}
          onCancel={() => setSelectedCommand(null)}
        />
      </div>
    );
  }

  if (flatList.length === 0) return null;

  let flatIndex = 0;

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute bottom-full left-0 z-50 mb-1 w-full max-h-[300px] overflow-y-auto",
        "rounded-lg bg-discord-bg-floating shadow-xl",
      )}
      role="listbox"
    >
      <div className="p-1.5">
        {Object.entries(grouped).map(([botName, cmds]) => (
          <div key={botName}>
            <div className="px-2 py-1 text-xs font-bold uppercase text-discord-header-secondary">
              {botName}
            </div>
            {cmds.map((cmd) => {
              const idx = flatIndex++;
              const isActive = idx === activeIndex;
              return (
                <button
                  key={cmd.id}
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  onClick={() => handleSelectCommand(cmd)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded px-2 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-discord-brand-blurple text-white"
                      : "text-discord-text-normal hover:bg-discord-bg-mod-hover",
                  )}
                >
                  <Avatar src={cmd.botAvatar} alt={cmd.botName} size={16} />
                  <div className="min-w-0 flex-1 text-left">
                    <span className="font-medium">/{cmd.name}</span>
                    <span
                      className={cn("ml-2", isActive ? "text-white/70" : "text-discord-text-muted")}
                    >
                      {cmd.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
