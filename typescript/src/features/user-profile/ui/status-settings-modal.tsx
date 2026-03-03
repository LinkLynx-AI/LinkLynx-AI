"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { cn } from "@/shared/lib/cn";

const presetStatuses = [
  { emoji: "🟢", label: "オンライン", value: "online" },
  { emoji: "🌙", label: "退席中", value: "idle" },
  { emoji: "⛔", label: "取り込み中", value: "dnd" },
  { emoji: "⚫", label: "オフライン表示", value: "offline" },
];

const clearAfterOptions = [
  { value: "today", label: "今日" },
  { value: "4h", label: "4時間" },
  { value: "1h", label: "1時間" },
  { value: "30m", label: "30分" },
  { value: "never", label: "消去しない" },
];

const presetEmojis = ["😀", "🎮", "💻", "🎵", "📚", "☕", "🔥", "✨"];

export function StatusSettingsModal({ onClose }: { onClose: () => void }) {
  const [statusText, setStatusText] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("😀");
  const [clearAfter, setClearAfter] = useState("today");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handlePresetClick = (preset: (typeof presetStatuses)[number]) => {
    setSelectedPreset(preset.value);
    setStatusText(preset.label);
  };

  const handleSave = () => {
    onClose();
  };

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>カスタムステータスを設定</ModalHeader>

      <ModalBody className="space-y-4">
        {/* Emoji picker row */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
            絵文字
          </div>
          <div className="flex gap-1">
            {presetEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setSelectedEmoji(emoji)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded text-lg transition-colors",
                  selectedEmoji === emoji
                    ? "bg-discord-brand-blurple"
                    : "bg-discord-bg-tertiary hover:bg-discord-bg-mod-hover",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Status text input */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{selectedEmoji}</span>
            <Input
              fullWidth
              placeholder="ステータスを設定"
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
            />
          </div>
        </div>

        {/* Preset statuses */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
            プリセット
          </div>
          <div className="grid grid-cols-2 gap-2">
            {presetStatuses.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  selectedPreset === preset.value
                    ? "bg-discord-brand-blurple text-white"
                    : "bg-discord-bg-tertiary text-discord-text-normal hover:bg-discord-bg-mod-hover",
                )}
              >
                <span>{preset.emoji}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Clear after dropdown */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
            消去するタイミング
          </div>
          <Select options={clearAfterOptions} value={clearAfter} onChange={setClearAfter} />
        </div>
      </ModalBody>

      <ModalFooter>
        <button
          onClick={onClose}
          className="rounded px-4 py-2 text-sm font-medium text-discord-text-normal hover:underline"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          className="rounded bg-discord-brand-blurple px-4 py-2 text-sm font-medium text-white hover:bg-discord-brand-blurple/80"
        >
          保存
        </button>
      </ModalFooter>
    </Modal>
  );
}
