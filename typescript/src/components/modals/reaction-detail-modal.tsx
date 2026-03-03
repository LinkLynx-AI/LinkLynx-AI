"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

interface MockUser {
  id: string;
  displayName: string;
  avatar: string | null;
}

const mockReactionUsers: Record<string, MockUser[]> = {
  "👍": [
    { id: "u1", displayName: "Tanaka Yuki", avatar: null },
    { id: "u2", displayName: "Sato Haruto", avatar: null },
    { id: "u3", displayName: "Yamada Aoi", avatar: null },
    { id: "u4", displayName: "Suzuki Ren", avatar: null },
    { id: "u5", displayName: "Takahashi Mei", avatar: null },
    { id: "u6", displayName: "Ito Sora", avatar: null },
    { id: "u7", displayName: "Watanabe Hina", avatar: null },
    { id: "u8", displayName: "Nakamura Riku", avatar: null },
    { id: "u9", displayName: "Kobayashi Yua", avatar: null },
    { id: "u10", displayName: "Kato Haruki", avatar: null },
    { id: "u11", displayName: "Yoshida Sakura", avatar: null },
    { id: "u12", displayName: "Yamamoto Sota", avatar: null },
  ],
  "❤️": [
    { id: "u1", displayName: "Tanaka Yuki", avatar: null },
    { id: "u3", displayName: "Yamada Aoi", avatar: null },
    { id: "u5", displayName: "Takahashi Mei", avatar: null },
    { id: "u7", displayName: "Watanabe Hina", avatar: null },
    { id: "u9", displayName: "Kobayashi Yua", avatar: null },
    { id: "u11", displayName: "Yoshida Sakura", avatar: null },
    { id: "u13", displayName: "Matsumoto Yuto", avatar: null },
    { id: "u14", displayName: "Inoue Akari", avatar: null },
  ],
  "😂": [
    { id: "u2", displayName: "Sato Haruto", avatar: null },
    { id: "u4", displayName: "Suzuki Ren", avatar: null },
    { id: "u6", displayName: "Ito Sora", avatar: null },
    { id: "u8", displayName: "Nakamura Riku", avatar: null },
    { id: "u10", displayName: "Kato Haruki", avatar: null },
  ],
};

const emojiTabs = [
  { emoji: "👍", count: 12 },
  { emoji: "❤️", count: 8 },
  { emoji: "😂", count: 5 },
];

export function ReactionDetailModal({
  onClose,
}: {
  onClose: () => void;
  messageId?: string;
  emoji?: string;
}) {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const totalCount = emojiTabs.reduce((sum, t) => sum + t.count, 0);

  const activeEmoji = selectedEmoji;
  const displayUsers = activeEmoji
    ? (mockReactionUsers[activeEmoji] ?? [])
    : (() => {
        const seen = new Set<string>();
        return Object.values(mockReactionUsers)
          .flat()
          .filter((u) => {
            if (seen.has(u.id)) return false;
            seen.add(u.id);
            return true;
          });
      })();

  return (
    <Modal open onClose={onClose} className="max-w-[480px]">
      <div className="flex h-[400px]">
        {/* Left: emoji tabs */}
        <div className="flex w-[140px] shrink-0 flex-col border-r border-discord-divider">
          <button
            onClick={() => setSelectedEmoji(null)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
              selectedEmoji === null
                ? "bg-discord-bg-mod-hover text-discord-text-normal"
                : "text-discord-text-muted hover:bg-discord-bg-mod-hover hover:text-discord-text-normal"
            )}
          >
            <span>すべて</span>
            <span className="text-xs text-discord-text-muted">{totalCount}</span>
          </button>
          {emojiTabs.map((tab) => (
            <button
              key={tab.emoji}
              onClick={() => setSelectedEmoji(tab.emoji)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                selectedEmoji === tab.emoji
                  ? "bg-discord-bg-mod-hover text-discord-text-normal"
                  : "text-discord-text-muted hover:bg-discord-bg-mod-hover hover:text-discord-text-normal"
              )}
            >
              <span>{tab.emoji}</span>
              <span className="text-xs text-discord-text-muted">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Right: user list */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {displayUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-discord-bg-mod-hover"
              >
                <Avatar
                  src={user.avatar ?? undefined}
                  alt={user.displayName}
                  size={32}
                />
                <span className="text-sm text-discord-text-normal">
                  {user.displayName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
