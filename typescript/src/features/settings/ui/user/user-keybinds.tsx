"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { KeybindRecorder } from "@/shared/ui/keybind-recorder";

type Keybind = {
  id: string;
  action: string;
  key: string;
};

const actionOptions = [
  { value: "push-to-talk", label: "Push-to-Talk" },
  { value: "mute-toggle", label: "ミュート切替" },
  { value: "deafen-toggle", label: "スピーカーミュート" },
  { value: "screen-share", label: "画面共有" },
  { value: "camera-toggle", label: "カメラ切替" },
  { value: "quick-switcher", label: "クイックスイッチャー" },
  { value: "search", label: "検索" },
];

const defaultKeybinds: Keybind[] = [
  { id: "1", action: "Push-to-Talk", key: "" },
  { id: "2", action: "ミュート切替", key: "Ctrl+Shift+M" },
  { id: "3", action: "スピーカーミュート", key: "Ctrl+Shift+D" },
  { id: "4", action: "画面共有", key: "Ctrl+Shift+S" },
  { id: "5", action: "カメラ切替", key: "Ctrl+Shift+V" },
];

export function UserKeybinds() {
  const [keybinds, setKeybinds] = useState<Keybind[]>(defaultKeybinds);
  const [newRow, setNewRow] = useState<{ action: string; key: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function findConflicts(key: string, excludeId?: string): string[] {
    if (!key) return [];
    return keybinds.filter((kb) => kb.key === key && kb.id !== excludeId).map((kb) => kb.action);
  }

  function handleKeyChange(id: string, key: string) {
    setKeybinds((prev) => prev.map((kb) => (kb.id === id ? { ...kb, key } : kb)));
    setEditingId(null);
  }

  function handleDelete(id: string) {
    setKeybinds((prev) => prev.filter((kb) => kb.id !== id));
  }

  function handleAddKeybind() {
    setNewRow({ action: "", key: "" });
  }

  function handleSaveNew() {
    if (!newRow || !newRow.action) return;
    const actionLabel =
      actionOptions.find((o) => o.value === newRow.action)?.label ?? newRow.action;
    setKeybinds((prev) => [
      ...prev,
      { id: String(Date.now()), action: actionLabel, key: newRow.key },
    ]);
    setNewRow(null);
  }

  function handleCancelNew() {
    setNewRow(null);
  }

  // Collect all conflicts
  const conflictMap = new Map<string, string[]>();
  for (const kb of keybinds) {
    if (kb.key) {
      const conflicts = findConflicts(kb.key, kb.id);
      if (conflicts.length > 0) {
        conflictMap.set(kb.id, conflicts);
      }
    }
  }

  return (
    <div className="pb-20">
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">キーバインド</h2>

      <div className="mb-4">
        <Button onClick={handleAddKeybind}>
          <Plus size={16} className="mr-1" />
          キーバインドを追加
        </Button>
      </div>

      {/* Keybind table */}
      <div className="overflow-hidden rounded-lg border border-discord-divider">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1fr_80px] gap-4 bg-discord-bg-secondary px-4 py-2">
          <span className="text-xs font-bold uppercase text-discord-header-secondary">
            アクション
          </span>
          <span className="text-xs font-bold uppercase text-discord-header-secondary">
            ショートカット
          </span>
          <span className="text-xs font-bold uppercase text-discord-header-secondary">操作</span>
        </div>

        {/* Rows */}
        {keybinds.map((kb) => {
          const conflicts = conflictMap.get(kb.id);
          return (
            <div key={kb.id}>
              <div
                className={cn(
                  "grid grid-cols-[1fr_1fr_80px] items-center gap-4 border-t border-discord-divider px-4 py-3",
                  conflicts && "bg-discord-brand-red/10",
                )}
              >
                <span className="text-sm text-discord-text-normal">{kb.action}</span>
                <div>
                  {editingId === kb.id ? (
                    <KeybindRecorder
                      value={kb.key}
                      onChange={(key) => handleKeyChange(kb.id, key)}
                      onClear={() => handleKeyChange(kb.id, "")}
                    />
                  ) : (
                    <span
                      className={cn(
                        "inline-block rounded bg-discord-bg-tertiary px-3 py-1.5 text-sm",
                        kb.key ? "text-discord-text-normal" : "text-discord-text-muted",
                      )}
                    >
                      {kb.key || "未設定"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingId(editingId === kb.id ? null : kb.id)}
                    className="flex h-8 w-8 items-center justify-center rounded text-discord-interactive-normal hover:text-discord-interactive-hover"
                    aria-label="編集"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(kb.id)}
                    className="flex h-8 w-8 items-center justify-center rounded text-discord-interactive-normal hover:text-discord-brand-red"
                    aria-label="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {conflicts && (
                <div className="border-t border-discord-divider bg-discord-brand-red/5 px-4 py-2">
                  <p className="text-xs text-discord-brand-red">
                    このショートカットは「{conflicts.join("」「")}」と競合しています
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* New row */}
        {newRow && (
          <div className="grid grid-cols-[1fr_1fr_80px] items-center gap-4 border-t border-discord-divider bg-discord-bg-tertiary px-4 py-3">
            <Select
              options={actionOptions}
              value={newRow.action}
              onChange={(v) => setNewRow({ ...newRow, action: v })}
              placeholder="アクションを選択..."
            />
            <KeybindRecorder
              value={newRow.key}
              onChange={(key) => setNewRow({ ...newRow, key })}
              onClear={() => setNewRow({ ...newRow, key: "" })}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSaveNew}>
                保存
              </Button>
              <button
                onClick={handleCancelNew}
                className="text-xs text-discord-text-muted hover:text-discord-text-normal"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
