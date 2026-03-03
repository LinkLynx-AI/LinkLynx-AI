"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import type { SlashCommand, SlashCommandOption } from "@/types/bot-components";

function OptionInput({
  option,
  value,
  onChange,
}: {
  option: SlashCommandOption;
  value: string;
  onChange: (value: string) => void;
}) {
  if (option.type === "boolean") {
    return (
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          className="h-3.5 w-3.5 rounded accent-discord-brand-blurple"
        />
        <span className="text-xs text-discord-text-muted">{option.name}</span>
      </label>
    );
  }

  if (option.type === "integer") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={option.name}
        className={cn(
          "w-20 rounded bg-discord-bg-tertiary px-2 py-1 text-sm",
          "text-discord-text-normal placeholder:text-discord-text-muted outline-none",
          "border border-transparent focus:border-discord-brand-blurple",
        )}
      />
    );
  }

  if (option.type === "user" || option.type === "channel" || option.type === "role") {
    const placeholderMap = {
      user: "@ユーザー",
      channel: "#チャンネル",
      role: "@ロール",
    };
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholderMap[option.type]}
        className={cn(
          "w-28 rounded bg-discord-bg-tertiary px-2 py-1 text-sm",
          "text-discord-text-normal placeholder:text-discord-text-muted outline-none",
          "border border-transparent focus:border-discord-brand-blurple",
        )}
      />
    );
  }

  // Default: string
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={option.name}
      className={cn(
        "w-32 rounded bg-discord-bg-tertiary px-2 py-1 text-sm",
        "text-discord-text-normal placeholder:text-discord-text-muted outline-none",
        "border border-transparent focus:border-discord-brand-blurple",
      )}
    />
  );
}

export function SlashCommandArgs({
  command,
  onSubmit,
  onCancel,
}: {
  command: SlashCommand;
  onSubmit: (args: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [args, setArgs] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const options = command.options ?? [];

  const updateArg = useCallback((name: string, value: string) => {
    setArgs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    const missingRequired = options.filter((opt) => opt.required && !args[opt.name]?.trim());
    if (missingRequired.length > 0) return;
    onSubmit(args);
  }, [args, options, onSubmit]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };
    const container = containerRef.current;
    container?.addEventListener("keydown", handler);
    return () => container?.removeEventListener("keydown", handler);
  }, [handleSubmit, onCancel]);

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-2 rounded-lg bg-discord-bg-secondary px-3 py-2"
    >
      <span className="rounded bg-discord-brand-blurple/20 px-2 py-0.5 text-sm font-medium text-discord-brand-blurple">
        /{command.name}
      </span>
      {options.map((option) => (
        <div key={option.name} className="flex items-center gap-1">
          <span className="text-xs text-discord-text-muted">
            {option.name}
            {option.required && <span className="ml-0.5 text-discord-btn-danger">*</span>}
          </span>
          <OptionInput
            option={option}
            value={args[option.name] ?? ""}
            onChange={(v) => updateArg(option.name, v)}
          />
        </div>
      ))}
      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={onCancel}
          className="rounded px-2 py-1 text-xs text-discord-text-muted hover:text-discord-text-normal transition-colors"
        >
          Esc
        </button>
        <button
          onClick={handleSubmit}
          className="rounded bg-discord-brand-blurple px-3 py-1 text-xs font-medium text-white hover:bg-discord-btn-blurple-hover transition-colors"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
