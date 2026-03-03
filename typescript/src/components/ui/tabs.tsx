"use client";

import { cn } from "@/lib/cn";

export function Tabs({
  tabs,
  activeTab,
  onChange,
  className,
}: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-6 border-b border-discord-divider", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative pb-2.5 text-sm font-medium transition-colors",
            tab.id === activeTab
              ? "text-discord-interactive-active"
              : "text-discord-interactive-normal hover:text-discord-interactive-hover"
          )}
        >
          {tab.label}
          {tab.id === activeTab && (
            <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-discord-interactive-active" />
          )}
        </button>
      ))}
    </div>
  );
}
