"use client";

import { useState } from "react";
import { Monitor, AppWindow, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Tabs } from "@/shared/ui/tabs-simple";

type ScreenSource = {
  type: "screen" | "window";
  id: string;
  name: string;
};

const mockScreens: ScreenSource[] = [];

const mockApps: ScreenSource[] = [];

const tabs = [
  { id: "screen", label: "画面" },
  { id: "application", label: "アプリケーション" },
];

const resolutions = ["720p", "1080p", "1440p"] as const;
const frameRates = ["15", "30", "60"] as const;

export function ScreenSharePicker({
  onSelect,
  onClose,
}: {
  onSelect: (source: ScreenSource) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState("screen");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string>("1080p");
  const [frameRate, setFrameRate] = useState<string>("30");

  const sources = activeTab === "screen" ? mockScreens : mockApps;
  const selected = sources.find((s) => s.id === selectedId) ?? null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex w-[640px] max-w-[90vw] flex-col rounded-lg bg-discord-bg-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-discord-header-primary">画面を共有</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-discord-interactive-normal hover:text-discord-interactive-hover"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        </div>

        {/* Source grid */}
        <div className="grid grid-cols-3 gap-3 p-4">
          {sources.map((source) => (
            <button
              key={source.id}
              onClick={() => setSelectedId(source.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors",
                selectedId === source.id
                  ? "border-discord-brand-blurple bg-discord-brand-blurple/10"
                  : "border-transparent bg-discord-bg-secondary hover:bg-discord-bg-tertiary",
              )}
            >
              <div className="flex h-20 w-full items-center justify-center rounded bg-discord-bg-tertiary">
                {source.type === "screen" ? (
                  <Monitor className="h-8 w-8 text-discord-text-muted" />
                ) : (
                  <AppWindow className="h-8 w-8 text-discord-text-muted" />
                )}
              </div>
              <span className="w-full truncate text-center text-xs text-discord-text-normal">
                {source.name}
              </span>
            </button>
          ))}
        </div>

        {/* Quality settings */}
        <div className="flex items-center gap-4 border-t border-discord-divider px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-discord-text-muted">解像度</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="rounded bg-discord-bg-secondary px-2 py-1 text-xs text-discord-text-normal"
            >
              {resolutions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-discord-text-muted">フレームレート</label>
            <select
              value={frameRate}
              onChange={(e) => setFrameRate(e.target.value)}
              className="rounded bg-discord-bg-secondary px-2 py-1 text-xs text-discord-text-normal"
            >
              {frameRates.map((f) => (
                <option key={f} value={f}>
                  {f}fps
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-discord-divider px-4 py-3">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-discord-text-normal hover:underline"
          >
            キャンセル
          </button>
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className={cn(
              "rounded px-4 py-2 text-sm font-medium text-white transition-colors",
              selected
                ? "bg-discord-brand-blurple hover:bg-discord-brand-blurple/80"
                : "cursor-not-allowed bg-discord-brand-blurple/50",
            )}
          >
            共有
          </button>
        </div>
      </div>
    </div>
  );
}
