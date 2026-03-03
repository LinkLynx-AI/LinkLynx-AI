"use client";

import { useState, useRef } from "react";
import { SmilePlus, Reply, Pencil, MessageSquare, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { useUIStore } from "@/stores/ui-store";
import { EmojiPicker } from "@/components/pickers";
import { PublishButton } from "./publish-button";
import type { Message } from "@/types";

export function MessageActions({
  message,
  channelId,
  onEdit,
  isAnnouncement,
}: {
  message?: Message;
  channelId?: string;
  onEdit?: () => void;
  isAnnouncement?: boolean;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const addToast = useUIStore((s) => s.addToast);

  const handleReactionSelect = (emoji: string) => {
    setShowEmojiPicker(false);
  };

  const handleThread = () => {
    addToast({ message: "スレッド作成は準備中です", type: "info" });
  };

  const handleMore = () => {
    if (!moreButtonRef.current || !message) return;
    const rect = moreButtonRef.current.getBoundingClientRect();
    showContextMenu("message", { x: rect.left, y: rect.bottom }, { message });
  };

  return (
    <div
      className={cn(
        "absolute -top-4 right-4 z-10",
        "flex items-center",
        "rounded border border-discord-divider bg-discord-bg-primary shadow",
      )}
    >
      {/* Reaction button */}
      <div className="relative">
        <button
          title="リアクションを追加"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={cn(
            "p-1.5 text-discord-interactive-normal",
            "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
            "rounded transition-colors",
          )}
        >
          <SmilePlus className="h-4 w-4" />
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-1">
            <EmojiPicker
              mode="reaction"
              onSelect={handleReactionSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}
      </div>

      {/* Edit button */}
      {onEdit && (
        <button
          title="編集"
          onClick={onEdit}
          className={cn(
            "p-1.5 text-discord-interactive-normal",
            "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
            "rounded transition-colors",
          )}
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}

      {/* Reply button */}
      <button
        title="返信"
        className={cn(
          "p-1.5 text-discord-interactive-normal",
          "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
          "rounded transition-colors",
        )}
      >
        <Reply className="h-4 w-4" />
      </button>

      {/* Thread button */}
      <button
        title="スレッドを作成"
        onClick={handleThread}
        className={cn(
          "p-1.5 text-discord-interactive-normal",
          "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
          "rounded transition-colors",
        )}
      >
        <MessageSquare className="h-4 w-4" />
      </button>

      {/* Publish button (announcement channels) */}
      {isAnnouncement && <PublishButton />}

      {/* More button */}
      <button
        ref={moreButtonRef}
        title="その他"
        onClick={handleMore}
        className={cn(
          "p-1.5 text-discord-interactive-normal",
          "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
          "rounded transition-colors",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}
