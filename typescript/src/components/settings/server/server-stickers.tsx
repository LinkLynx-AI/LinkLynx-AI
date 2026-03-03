"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ServerSticker = {
  id: string;
  name: string;
  description: string;
  color: string;
};

const initialStickers: ServerSticker[] = [
  { id: "s1", name: "wave", description: "手を振る挨拶", color: "#3498db" },
  { id: "s2", name: "party", description: "パーティータイム!", color: "#e74c3c" },
  { id: "s3", name: "gg", description: "Good Game!", color: "#2ecc71" },
];

const MAX_SLOTS = 5;

export function ServerStickers({ serverId }: { serverId: string }) {
  const [stickers, setStickers] = useState<ServerSticker[]>(initialStickers);

  function deleteSticker(id: string) {
    setStickers((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-discord-header-primary">スタンプ</h2>
        <Button>アップロード</Button>
      </div>

      {/* Slot usage */}
      <div className="mb-6 text-sm text-discord-text-muted">
        {stickers.length}/{MAX_SLOTS} スロット使用中
      </div>

      {/* Sticker grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stickers.map((sticker) => (
          <div
            key={sticker.id}
            className="group relative rounded-lg border border-discord-divider bg-discord-bg-secondary p-4 transition-colors hover:bg-discord-bg-mod-hover"
          >
            {/* Sticker preview placeholder */}
            <div
              className="mx-auto mb-3 h-20 w-20 rounded-lg"
              style={{ backgroundColor: sticker.color }}
            />
            <div className="text-center">
              <p className="text-sm font-medium text-discord-text-normal">{sticker.name}</p>
              <p className="mt-0.5 text-xs text-discord-text-muted">{sticker.description}</p>
            </div>

            <button
              onClick={() => deleteSticker(sticker.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 rounded p-1 text-discord-text-muted hover:text-discord-btn-danger hover:bg-discord-bg-primary transition-all"
              aria-label={`${sticker.name}を削除`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
