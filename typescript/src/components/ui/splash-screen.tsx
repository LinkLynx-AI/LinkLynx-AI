"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";

const DEFAULT_TIPS = [
  "ヒント: Ctrl+K でクイックスイッチャーを開けます",
  "ヒント: Shift+Enter で改行できます",
  "ヒント: 絵文字は : で検索できます",
];

export function SplashScreen({
  progress = 0,
  tips = DEFAULT_TIPS,
}: {
  progress?: number;
  tips?: string[];
}) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (tips.length <= 1) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [tips]);

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-discord-bg-tertiary">
      {/* Logo placeholder */}
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-discord-brand-blurple">
        <span className="text-3xl font-bold text-white">D</span>
      </div>

      <h1 className="mb-8 text-xl font-semibold text-white">Discord</h1>

      {/* Progress bar */}
      <div className="mb-2 w-64">
        <div className="h-2 overflow-hidden rounded-full bg-discord-bg-secondary">
          <div
            className="h-full rounded-full bg-discord-brand-blurple transition-[width] duration-300"
            style={{ width: `${clampedProgress}%` }}
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      <p className="mb-6 text-sm text-discord-text-muted">
        {clampedProgress}%
      </p>

      {/* Rotating tip */}
      {tips.length > 0 && (
        <p
          className={cn(
            "max-w-md text-center text-sm text-discord-text-muted",
            "transition-opacity duration-500"
          )}
        >
          {tips[tipIndex]}
        </p>
      )}
    </div>
  );
}
