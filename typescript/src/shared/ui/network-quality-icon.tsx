"use client";

import { cn } from "@/shared/lib/cn";

type Quality = "excellent" | "good" | "fair" | "poor" | "disconnected";

const barConfig: Record<Quality, { activeBars: number; color: string }> = {
  excellent: { activeBars: 4, color: "bg-green-500" },
  good: { activeBars: 3, color: "bg-green-500" },
  fair: { activeBars: 2, color: "bg-yellow-500" },
  poor: { activeBars: 1, color: "bg-red-500" },
  disconnected: { activeBars: 0, color: "" },
};

const barHeights = ["h-1.5", "h-2.5", "h-3.5", "h-[18px]"];

export function NetworkQualityIcon({
  quality,
  className,
}: {
  quality: Quality;
  className?: string;
}) {
  const { activeBars, color } = barConfig[quality];

  return (
    <div
      className={cn("relative inline-flex items-end gap-0.5", className)}
      role="img"
      aria-label={`ネットワーク品質: ${quality}`}
    >
      {barHeights.map((height, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-sm",
            height,
            i < activeBars ? color : "bg-discord-text-muted/30",
          )}
        />
      ))}
      {quality === "disconnected" && (
        <svg
          className="absolute -right-1 -top-1 h-3 w-3 text-red-500"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <line x1="2" y1="2" x2="10" y2="10" />
          <line x1="10" y1="2" x2="2" y2="10" />
        </svg>
      )}
    </div>
  );
}
