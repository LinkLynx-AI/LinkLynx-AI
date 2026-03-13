"use client";

import { useRef } from "react";
import { SmilePlus, Reply, Pencil, MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { PublishButton } from "./publish-button";
import type { Message } from "@/shared/model/types";

export function MessageActions({
  message,
  channelId,
  onEdit,
  onDelete,
  isAnnouncement,
}: {
  message?: Message;
  channelId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  isAnnouncement?: boolean;
}) {
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const addToast = useUIStore((s) => s.addToast);

  const handleReaction = () => {
    addToast({ message: "リアクション追加は v1 では未接続です。", type: "info" });
  };

  const handleReply = () => {
    addToast({ message: "返信送信は v1 では未接続です。", type: "info" });
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
      <button
        title="リアクションを追加"
        onClick={handleReaction}
        className={cn(
          "p-1.5 text-discord-interactive-normal",
          "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
          "rounded transition-colors",
        )}
      >
        <SmilePlus className="h-4 w-4" />
      </button>

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

      {onDelete && (
        <button
          title="削除"
          onClick={onDelete}
          className={cn(
            "p-1.5 text-discord-interactive-normal",
            "hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover",
            "rounded transition-colors",
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Reply button */}
      <button
        title="返信"
        onClick={handleReply}
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
