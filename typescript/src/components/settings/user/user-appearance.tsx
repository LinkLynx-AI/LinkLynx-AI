"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

type Theme = "dark" | "light" | "ash" | "onyx";
type MessageDisplay = "compact" | "cozy";

const themes: { id: Theme; label: string; bg: string; sidebar: string; text: string }[] = [
  { id: "dark", label: "ダーク", bg: "#313338", sidebar: "#2b2d31", text: "#dbdee1" },
  { id: "light", label: "ライト", bg: "#ffffff", sidebar: "#f2f3f5", text: "#313338" },
  { id: "ash", label: "アッシュ", bg: "#3a3c41", sidebar: "#35373b", text: "#dbdee1" },
  { id: "onyx", label: "オニキス", bg: "#1e1f22", sidebar: "#1a1b1e", text: "#dbdee1" },
];

export function UserAppearance() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [messageDisplay, setMessageDisplay] = useState<MessageDisplay>("cozy");
  const [fontSize, setFontSize] = useState(16);
  const [zoom, setZoom] = useState(100);
  const [hasChanges, setHasChanges] = useState(false);

  function handleThemeChange(t: Theme) {
    setTheme(t);
    setHasChanges(true);
  }

  function handleDisplayChange(d: MessageDisplay) {
    setMessageDisplay(d);
    setHasChanges(true);
  }

  function handleFontSizeChange(v: number) {
    setFontSize(v);
    setHasChanges(true);
  }

  function handleZoomChange(v: number) {
    setZoom(v);
    setHasChanges(true);
  }

  function handleReset() {
    setTheme("dark");
    setMessageDisplay("cozy");
    setFontSize(16);
    setZoom(100);
    setHasChanges(false);
  }

  return (
    <div className="pb-20">
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">
        外観
      </h2>

      {/* Theme selection */}
      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          テーマ
        </h3>
        <div className="grid grid-cols-4 gap-4" role="radiogroup" aria-label="テーマ">
          {themes.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={theme === t.id}
              onClick={() => handleThemeChange(t.id)}
              className={cn(
                "flex flex-col overflow-hidden rounded-lg border-2 transition-colors",
                theme === t.id
                  ? "border-discord-brand-blurple"
                  : "border-transparent hover:border-discord-interactive-muted"
              )}
            >
              {/* Mini preview */}
              <div className="flex h-[60px]">
                <div className="w-1/3" style={{ backgroundColor: t.sidebar }} />
                <div className="flex-1 p-2" style={{ backgroundColor: t.bg }}>
                  <div
                    className="h-2 w-3/4 rounded"
                    style={{ backgroundColor: t.text, opacity: 0.3 }}
                  />
                  <div
                    className="mt-1 h-2 w-1/2 rounded"
                    style={{ backgroundColor: t.text, opacity: 0.2 }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 bg-discord-bg-secondary px-3 py-2">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    theme === t.id
                      ? "border-discord-brand-blurple"
                      : "border-discord-interactive-normal"
                  )}
                >
                  {theme === t.id && (
                    <span className="h-2.5 w-2.5 rounded-full bg-discord-brand-blurple" />
                  )}
                </span>
                <span className="text-sm font-medium text-discord-text-normal">
                  {t.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Message Display */}
      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          メッセージの表示
        </h3>
        <div className="flex gap-4" role="radiogroup" aria-label="メッセージの表示">
          {([
            { id: "cozy" as const, label: "心地よい" },
            { id: "compact" as const, label: "コンパクト" },
          ]).map((d) => (
            <button
              key={d.id}
              role="radio"
              aria-checked={messageDisplay === d.id}
              onClick={() => handleDisplayChange(d.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border-2 px-4 py-3 transition-colors",
                messageDisplay === d.id
                  ? "border-discord-brand-blurple"
                  : "border-discord-interactive-muted hover:border-discord-interactive-normal"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2",
                  messageDisplay === d.id
                    ? "border-discord-brand-blurple"
                    : "border-discord-interactive-normal"
                )}
              >
                {messageDisplay === d.id && (
                  <span className="h-2.5 w-2.5 rounded-full bg-discord-brand-blurple" />
                )}
              </span>
              <span className="text-sm font-medium text-discord-text-normal">
                {d.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Font Size */}
      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          チャットのフォントサイズ
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-xs text-discord-text-muted">12px</span>
          <input
            type="range"
            min={12}
            max={20}
            value={fontSize}
            onChange={(e) => handleFontSizeChange(Number(e.target.value))}
            className="flex-1 accent-discord-brand-blurple"
            aria-label="フォントサイズ"
          />
          <span className="text-xs text-discord-text-muted">20px</span>
          <span className="min-w-[40px] text-right text-sm text-discord-text-normal">
            {fontSize}px
          </span>
        </div>
      </section>

      {/* Zoom */}
      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          ズームレベル
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-xs text-discord-text-muted">50%</span>
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="flex-1 accent-discord-brand-blurple"
            aria-label="ズームレベル"
          />
          <span className="text-xs text-discord-text-muted">200%</span>
          <span className="min-w-[40px] text-right text-sm text-discord-text-normal">
            {zoom}%
          </span>
        </div>
      </section>

      {/* Save bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-discord-bg-tertiary px-6 py-3 shadow-lg">
          <span className="text-sm text-discord-text-normal">
            注意 -- 保存されていない変更があります！
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="text-sm font-medium text-discord-text-link hover:underline"
            >
              リセット
            </button>
            <Button onClick={() => setHasChanges(false)}>変更を保存</Button>
          </div>
        </div>
      )}
    </div>
  );
}
