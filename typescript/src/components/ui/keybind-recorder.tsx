"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function KeybindRecorder({
  value,
  onChange,
  onClear,
  className,
}: {
  value: string;
  onChange: (keys: string) => void;
  onClear?: () => void;
  className?: string;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setIsRecording(false);
        return;
      }

      // Skip standalone modifier keys
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

      onChange(parts.join("+"));
      setIsRecording(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, onChange]);

  return (
    <div
      ref={containerRef}
      onClick={() => setIsRecording(true)}
      className={cn(
        "inline-flex items-center gap-2 rounded bg-discord-bg-tertiary px-3 py-1.5 text-sm transition-all cursor-pointer select-none",
        isRecording
          ? "border border-discord-brand-blurple animate-pulse text-discord-text-normal"
          : "border border-discord-interactive-muted text-discord-text-muted hover:border-discord-interactive-normal",
        className
      )}
    >
      <span>
        {isRecording
          ? "キーを押してください..."
          : value || "未設定"}
      </span>
      {value && !isRecording && onClear && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="flex h-4 w-4 items-center justify-center rounded-full text-discord-interactive-normal hover:text-discord-interactive-hover"
          aria-label="キーバインドをクリア"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
