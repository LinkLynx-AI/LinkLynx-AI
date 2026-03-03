"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";

export function ScreenShareModal({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}) {
  const [tab, setTab] = useState<"screen" | "app">("screen");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [selected, setSelected] = useState<number | null>(null);

  const handleStart = () => {
    onStart();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader>画面を共有</ModalHeader>
      <ModalBody>
        <div className="mb-4 flex gap-2 border-b border-discord-divider">
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              tab === "screen"
                ? "border-b-2 border-discord-brand-blurple text-discord-text-normal"
                : "text-discord-text-muted hover:text-discord-text-normal",
            )}
            onClick={() => {
              setTab("screen");
              setSelected(null);
            }}
          >
            画面
          </button>
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              tab === "app"
                ? "border-b-2 border-discord-brand-blurple text-discord-text-normal"
                : "text-discord-text-muted hover:text-discord-text-normal",
            )}
            onClick={() => {
              setTab("app");
              setSelected(null);
            }}
          >
            アプリケーション
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(tab === "screen"
            ? [{ id: 0, label: "画面 1", color: "from-blue-900/40 to-blue-700/20" }]
            : [
                { id: 0, label: "ブラウザ", color: "from-orange-900/40 to-orange-700/20" },
                { id: 1, label: "エディタ", color: "from-purple-900/40 to-purple-700/20" },
                { id: 2, label: "ターミナル", color: "from-green-900/40 to-green-700/20" },
              ]
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-colors",
                selected === item.id
                  ? "border-discord-brand-blurple"
                  : "border-transparent hover:border-discord-interactive-normal/30",
              )}
            >
              <div className={cn("h-20 w-full rounded bg-gradient-to-br", item.color)} />
              <span className="text-xs text-discord-text-muted">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <label className="text-sm text-discord-text-muted">解像度:</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as "720p" | "1080p")}
            className="rounded bg-discord-bg-tertiary px-2 py-1 text-sm text-discord-text-normal"
          >
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          キャンセル
        </Button>
        <Button onClick={handleStart} disabled={selected === null}>
          共有を開始
        </Button>
      </ModalFooter>
    </Modal>
  );
}
