"use client";

import { Shield } from "lucide-react";

export function StreamerModeBanner({ onDisable }: { onDisable: () => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-purple-500 px-4 py-2">
      <Shield className="h-4 w-4 text-white" />
      <span className="text-sm font-medium text-white">ストリーマーモードが有効です</span>
      <button
        onClick={onDisable}
        className="ml-2 rounded bg-white/20 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-white/30"
      >
        無効にする
      </button>
    </div>
  );
}
