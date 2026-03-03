"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { Toggle } from "@/shared/ui/legacy/toggle";
import { Select } from "@/shared/ui/legacy/select";
import { Slider } from "@/shared/ui/legacy/slider";

type StickerAnimation = "always" | "hover" | "never";

const colorVisionOptions = [
  { value: "none", label: "なし" },
  { value: "protanopia", label: "第1色覚 (Protanopia)" },
  { value: "deuteranopia", label: "第2色覚 (Deuteranopia)" },
  { value: "tritanopia", label: "第3色覚 (Tritanopia)" },
];

export function UserAccessibility() {
  const [ttsRate, setTtsRate] = useState(1.0);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [stickerAnimation, setStickerAnimation] = useState<StickerAnimation>("always");
  const [colorVision, setColorVision] = useState("none");
  const [focusIndicator, setFocusIndicator] = useState(false);
  const [underlineLinks, setUnderlineLinks] = useState(false);

  return (
    <div className="pb-20">
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">アクセシビリティ</h2>

      {/* TTS Rate */}
      <section className="mb-8 border-b border-discord-divider pb-8">
        <Slider
          label="テキスト読み上げ速度"
          min={0.1}
          max={10}
          step={0.1}
          value={ttsRate}
          onChange={setTtsRate}
          showValue
          formatValue={(v) => `${v.toFixed(1)}x`}
        />
      </section>

      {/* High Contrast */}
      <section className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">高コントラストモード</h3>
          <p className="text-xs text-discord-text-muted">テキストと要素のコントラストを高めます</p>
        </div>
        <Toggle checked={highContrast} onChange={setHighContrast} />
      </section>

      {/* Reduce Motion */}
      <section className="mb-8 flex items-center justify-between border-b border-discord-divider pb-8">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">アニメーションを減らす</h3>
          <p className="text-xs text-discord-text-muted">
            モーションが減り、自動再生GIFが停止されます
          </p>
        </div>
        <Toggle checked={reduceMotion} onChange={setReduceMotion} />
      </section>

      {/* Sticker Animation */}
      <section className="mb-8 border-b border-discord-divider pb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          スタンプアニメーション
        </h3>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="スタンプアニメーション">
          {[
            { id: "always" as const, label: "常に再生" },
            { id: "hover" as const, label: "ホバー時のみ" },
            { id: "never" as const, label: "再生しない" },
          ].map((opt) => (
            <button
              key={opt.id}
              role="radio"
              aria-checked={stickerAnimation === opt.id}
              onClick={() => setStickerAnimation(opt.id)}
              className="flex items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-discord-bg-mod-hover"
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2",
                  stickerAnimation === opt.id
                    ? "border-discord-brand-blurple"
                    : "border-discord-interactive-normal",
                )}
              >
                {stickerAnimation === opt.id && (
                  <span className="h-2.5 w-2.5 rounded-full bg-discord-brand-blurple" />
                )}
              </span>
              <span className="text-sm text-discord-text-normal">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Color Vision Mode */}
      <section className="mb-8 border-b border-discord-divider pb-8">
        <h3 className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
          色覚モード
        </h3>
        <Select
          options={colorVisionOptions}
          value={colorVision}
          onChange={setColorVision}
          className="max-w-md"
        />
      </section>

      {/* Focus Indicator */}
      <section className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">
            フォーカスインジケーター常時表示
          </h3>
          <p className="text-xs text-discord-text-muted">キーボードフォーカスを常に表示します</p>
        </div>
        <Toggle checked={focusIndicator} onChange={setFocusIndicator} />
      </section>

      {/* Underline Links */}
      <section className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">リンクに下線を表示</h3>
          <p className="text-xs text-discord-text-muted">
            メッセージ内のリンクに下線を付けて識別しやすくします
          </p>
        </div>
        <Toggle checked={underlineLinks} onChange={setUnderlineLinks} />
      </section>
    </div>
  );
}
