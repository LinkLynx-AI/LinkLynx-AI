"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/cn";

type NotificationSetting = "all" | "mentions" | "nothing";

const options: { value: NotificationSetting; label: string; description: string }[] = [
  {
    value: "all",
    label: "すべてのメッセージ",
    description: "スレッドのすべてのメッセージの通知を受け取ります",
  },
  {
    value: "mentions",
    label: "@mentionsのみ",
    description: "メンションされた場合のみ通知を受け取ります",
  },
  {
    value: "nothing",
    label: "通知なし",
    description: "このスレッドの通知をミュートします",
  },
];

export function ThreadNotificationMenu({
  currentSetting,
  onChange,
  onClose,
}: {
  currentSetting: NotificationSetting;
  onChange: (setting: NotificationSetting) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn(
        "absolute right-0 top-full z-50 mt-1 w-[250px]",
        "rounded-lg bg-discord-bg-floating p-1.5 shadow-xl",
      )}
    >
      <div className="px-2 py-1.5 text-xs font-bold uppercase text-discord-header-secondary">
        スレッドの通知設定
      </div>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => {
            onChange(option.value);
            onClose();
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded px-2 py-2 text-sm transition-colors",
            "hover:bg-discord-brand-blurple hover:text-white",
            currentSetting === option.value
              ? "text-discord-text-normal"
              : "text-discord-text-muted",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
              currentSetting === option.value
                ? "border-discord-brand-blurple"
                : "border-discord-text-muted",
            )}
          >
            {currentSetting === option.value && (
              <span className="h-2 w-2 rounded-full bg-discord-brand-blurple" />
            )}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="font-medium">{option.label}</div>
            <div className="text-xs opacity-60">{option.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
