"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { Sound } from "./soundboard-types";

export function SoundButton({ sound, onPlay }: { sound: Sound; onPlay: (sound: Sound) => void }) {
  const [playing, setPlaying] = useState(false);

  const handleClick = () => {
    if (playing) return;
    setPlaying(true);
    onPlay(sound);
    setTimeout(() => setPlaying(false), sound.duration * 1000);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={sound.name}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg p-2 transition-colors",
        "hover:bg-discord-bg-mod-hover",
        playing && "bg-discord-brand-blurple/20 scale-95 transition-transform",
      )}
    >
      <span className="text-2xl" role="img" aria-hidden>
        {sound.emoji}
      </span>
      <span className="text-xs text-discord-text-muted truncate w-full text-center">
        {sound.name}
      </span>
      {playing && (
        <div className="flex items-center gap-0.5" aria-label="再生中">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block w-0.5 bg-discord-brand-blurple rounded-full animate-pulse"
              style={{
                height: `${8 + (i % 2) * 4}px`,
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
}
