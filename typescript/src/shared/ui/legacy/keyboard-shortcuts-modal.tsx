"use client";

import { Modal, ModalHeader, ModalBody } from "./modal";
import { cn } from "@/shared/lib/legacy/cn";

const SHORTCUT_SECTIONS = [
  {
    title: "ナビゲーション",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "クイックスイッチャーを開く" },
      { keys: ["Ctrl", "/"], description: "キーボードショートカットを表示" },
      { keys: ["Alt", "↑"], description: "前のチャンネルへ" },
      { keys: ["Alt", "↓"], description: "次のチャンネルへ" },
    ],
  },
  {
    title: "メッセージ",
    shortcuts: [
      { keys: ["Enter"], description: "メッセージを送信" },
      { keys: ["Shift", "Enter"], description: "改行" },
      { keys: ["↑"], description: "最後のメッセージを編集" },
      { keys: ["Escape"], description: "編集をキャンセル" },
    ],
  },
  {
    title: "テキスト書式",
    shortcuts: [
      { keys: ["Ctrl", "B"], description: "太字" },
      { keys: ["Ctrl", "I"], description: "斜体" },
      { keys: ["Ctrl", "U"], description: "下線" },
      { keys: ["Ctrl", "Shift", "X"], description: "取り消し線" },
    ],
  },
] as const;

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[24px] items-center justify-center rounded px-1.5 py-0.5",
        "bg-discord-bg-tertiary text-xs font-medium text-discord-text-normal",
        "border border-discord-divider",
      )}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <ModalHeader>キーボードショートカット</ModalHeader>
      <ModalBody className="max-h-[60vh] overflow-y-auto">
        <div className="space-y-6">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-discord-text-normal">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-xs text-discord-text-muted">+</span>}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
}
