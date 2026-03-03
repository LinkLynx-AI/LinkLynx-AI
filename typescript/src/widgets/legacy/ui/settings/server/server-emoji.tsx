"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";
import { Button } from "@/shared/ui/legacy/button";

type ServerEmojiItem = {
  id: string;
  name: string;
  color: string;
  uploadedBy: string;
};

const initialEmojis: ServerEmojiItem[] = [
  { id: "e1", name: "pepe_happy", color: "#2ecc71", uploadedBy: "alice" },
  { id: "e2", name: "catjam", color: "#f39c12", uploadedBy: "bob" },
  { id: "e3", name: "sadge", color: "#3498db", uploadedBy: "charlie" },
  { id: "e4", name: "pog", color: "#e74c3c", uploadedBy: "alice" },
  { id: "e5", name: "monka", color: "#9b59b6", uploadedBy: "bob" },
  { id: "e6", name: "kekw", color: "#1abc9c", uploadedBy: "charlie" },
  { id: "e7", name: "copium", color: "#e67e22", uploadedBy: "alice" },
  { id: "e8", name: "based", color: "#e91e63", uploadedBy: "bob" },
];

const MAX_SLOTS = 50;

export function ServerEmoji({ serverId }: { serverId: string }) {
  const [emojis, setEmojis] = useState<ServerEmojiItem[]>(initialEmojis);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function startEdit(emoji: ServerEmojiItem) {
    setEditingId(emoji.id);
    setEditName(emoji.name);
  }

  function saveEdit(id: string) {
    if (editName.trim()) {
      setEmojis((prev) => prev.map((e) => (e.id === id ? { ...e, name: editName.trim() } : e)));
    }
    setEditingId(null);
  }

  function deleteEmoji(id: string) {
    setEmojis((prev) => prev.filter((e) => e.id !== id));
  }

  const usagePercent = (emojis.length / MAX_SLOTS) * 100;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-discord-header-primary">絵文字</h2>
        <Button>アップロード</Button>
      </div>

      {/* Slot usage */}
      <div className="mb-6">
        <div className="mb-1 text-sm text-discord-text-muted">
          {emojis.length}/{MAX_SLOTS} スロット使用中
        </div>
        <div className="h-2 w-full max-w-[320px] rounded-full bg-discord-bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-discord-brand-blurple transition-all"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-1 gap-1">
        {emojis.map((emoji) => (
          <div
            key={emoji.id}
            className="group flex items-center gap-3 rounded px-3 py-2 hover:bg-discord-bg-mod-hover transition-colors"
          >
            {/* Emoji preview placeholder */}
            <div className="h-8 w-8 shrink-0 rounded" style={{ backgroundColor: emoji.color }} />

            {/* Name (editable) */}
            {editingId === emoji.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(emoji.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={() => saveEdit(emoji.id)}
                autoFocus
                className="h-7 w-[160px] rounded-[3px] bg-discord-input-bg px-2 text-sm text-discord-text-normal outline-none focus:outline-2 focus:outline-discord-brand-blurple"
              />
            ) : (
              <button
                onClick={() => startEdit(emoji)}
                className="text-sm text-discord-text-normal hover:underline text-left"
              >
                :{emoji.name}:
              </button>
            )}

            <span className="flex-1 text-xs text-discord-text-muted">{emoji.uploadedBy}</span>

            <button
              onClick={() => deleteEmoji(emoji.id)}
              className="opacity-0 group-hover:opacity-100 text-discord-text-muted hover:text-discord-btn-danger transition-all"
              aria-label={`${emoji.name}を削除`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
