"use client";

import { useState, useMemo } from "react";
import { cn } from "@/shared/lib/cn";
import { Tabs } from "@/shared/ui/tabs-simple";
import { SoundButton } from "./sound-button";
import { mockSounds } from "./soundboard-mock-data";
import type { Sound } from "./soundboard-types";

const tabs = [
  { id: "favorites", label: "お気に入り" },
  { id: "all", label: "すべて" },
];

export function SoundboardPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("favorites");

  const filteredSounds = useMemo(() => {
    if (activeTab === "favorites") {
      return mockSounds.filter((s) => s.favorite);
    }
    return mockSounds;
  }, [activeTab]);

  const handlePlay = (sound: Sound) => {
    // Mock play - in real app would play audio via voice connection
    void sound;
  };

  return (
    <div
      className={cn(
        "w-72 rounded-lg border border-discord-divider bg-discord-bg-floating shadow-xl",
        "flex flex-col",
      )}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <h3 className="text-sm font-semibold text-discord-header-primary">サウンドボード</h3>
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="text-discord-interactive-normal hover:text-discord-interactive-hover"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
          </svg>
        </button>
      </div>

      <div className="px-3">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="grid grid-cols-4 gap-1 p-2 max-h-64 overflow-y-auto">
        {filteredSounds.length === 0 ? (
          <p className="col-span-4 py-4 text-center text-sm text-discord-text-muted">
            お気に入りのサウンドがありません
          </p>
        ) : (
          filteredSounds.map((sound) => (
            <SoundButton key={sound.id} sound={sound} onPlay={handlePlay} />
          ))
        )}
      </div>
    </div>
  );
}
