"use client";

import { Lock } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type NitroGateProps = {
  feature: string;
  children: React.ReactNode;
};

export function NitroGate({ feature, children }: NitroGateProps) {
  return (
    <div className="relative">
      {children}
      <div
        className={cn(
          "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
          "rounded-lg bg-black/60 backdrop-blur-sm",
        )}
      >
        <Lock className="h-8 w-8 text-white/80" />
        <p className="px-4 text-center text-sm font-medium text-white">
          Nitroで{feature}をアンロック
        </p>
        <button
          className={cn(
            "rounded-full px-6 py-2 text-sm font-semibold text-white",
            "bg-gradient-to-r from-[#5865f2] to-[#eb459e]",
            "hover:from-[#4752c4] hover:to-[#d63d8a] transition-all",
          )}
        >
          Nitroを入手
        </button>
      </div>
    </div>
  );
}
