"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";

interface LinkPopoverProps {
  onInsert: (url: string, text: string) => void;
  onClose: () => void;
}

export function LinkPopover({ onInsert, onClose }: LinkPopoverProps) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  const handleInsert = () => {
    if (!url.trim()) return;
    onInsert(url.trim(), text.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInsert();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className={cn(
        "absolute bottom-full left-0 z-50 mb-2",
        "w-72 rounded-lg bg-discord-bg-floating p-3 shadow-xl",
        "border border-discord-bg-mod-faint"
      )}
    >
      <div className="flex flex-col gap-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-discord-text-muted">
            URL
          </label>
          <input
            ref={urlInputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com"
            className={cn(
              "w-full rounded bg-discord-input-bg px-2.5 py-1.5 text-sm text-discord-text-normal",
              "placeholder:text-discord-text-muted outline-none",
              "border border-discord-bg-mod-faint focus:border-discord-brand"
            )}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-discord-text-muted">
            テキスト
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="表示テキスト"
            className={cn(
              "w-full rounded bg-discord-input-bg px-2.5 py-1.5 text-sm text-discord-text-normal",
              "placeholder:text-discord-text-muted outline-none",
              "border border-discord-bg-mod-faint focus:border-discord-brand"
            )}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded px-3 py-1.5 text-sm",
              "text-discord-text-normal hover:underline"
            )}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!url.trim()}
            className={cn(
              "rounded bg-discord-brand px-3 py-1.5 text-sm font-medium text-white",
              "hover:bg-discord-brand-hover disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          >
            挿入
          </button>
        </div>
      </div>
    </div>
  );
}
