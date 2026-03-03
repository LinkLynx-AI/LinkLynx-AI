"use client";

import { useCallback, useState, useRef, type KeyboardEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { formatMessageTimestamp, formatShortTimestamp } from "@/lib/format-date";
import { useUIStore } from "@/stores/ui-store";
import { useEditMessage } from "@/services/mutations/use-edit-message";
import type { Message as MessageType } from "@/types/message";
import { MessageActions } from "./message-actions";
import { MessageAttachment } from "./message-attachment";
import { MessageContent } from "./message-content";
import { MessageEmbed } from "./message-embed";
import { MessageReactions } from "./message-reactions";
import { MessageReply } from "./message-reply";
import { SystemMessage } from "./system-message";
import { BotComponents } from "./bot-components";
import { EphemeralBanner, isEphemeral } from "./ephemeral-message";

const SYSTEM_TYPES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

function InlineEditForm({
  content,
  onSave,
  onCancel,
}: {
  content: string;
  onSave: (newContent: string) => void;
  onCancel: () => void;
}) {
  const [editContent, setEditContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = editContent.trim();
        if (trimmed && trimmed !== content) {
          onSave(trimmed);
        } else {
          onCancel();
        }
      }
    },
    [editContent, content, onSave, onCancel],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, []);

  return (
    <div className="my-1">
      <textarea
        ref={textareaRef}
        value={editContent}
        onChange={(e) => {
          setEditContent(e.target.value);
          handleInput();
        }}
        onKeyDown={handleKeyDown}
        autoFocus
        rows={1}
        className={cn(
          "w-full resize-none rounded-lg p-2",
          "bg-discord-input-bg text-base text-discord-text-normal",
          "outline-none",
          "max-h-[300px] min-h-[40px]",
        )}
      />
      <span className="mt-1 block text-xs text-discord-text-muted">
        Escで
        <button onClick={onCancel} className="text-discord-link hover:underline">
          キャンセル
        </button>{" "}
        • Enterで
        <button
          onClick={() => {
            const trimmed = editContent.trim();
            if (trimmed && trimmed !== content) onSave(trimmed);
            else onCancel();
          }}
          className="text-discord-link hover:underline"
        >
          保存
        </button>
      </span>
    </div>
  );
}

export function Message({ message, isGrouped }: { message: MessageType; isGrouped: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ephemeral = isEphemeral(message.flags);
  const showProfilePopout = useUIStore((s) => s.showProfilePopout);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const { mutate: editMessage } = useEditMessage();

  const startEditing = useCallback(() => {
    setEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditing(false);
  }, []);

  const saveEdit = useCallback(
    (newContent: string) => {
      editMessage({
        channelId: message.channelId,
        messageId: message.id,
        data: { content: newContent },
      });
      setEditing(false);
    },
    [editMessage, message.channelId, message.id],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      showContextMenu("message", { x: e.clientX, y: e.clientY }, { message });
    },
    [message, showContextMenu],
  );

  const handleProfileClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      showProfilePopout(message.author.id, { x: rect.right + 8, y: rect.top });
    },
    [message.author.id, showProfilePopout],
  );

  if (ephemeral && dismissed) return null;

  if (SYSTEM_TYPES.has(message.type)) {
    return <SystemMessage message={message} />;
  }

  const renderContent = () => {
    if (editing) {
      return (
        <InlineEditForm content={message.content} onSave={saveEdit} onCancel={cancelEditing} />
      );
    }

    return (
      <>
        <MessageContent content={message.content} mentions={message.mentions} />
        {message.editedTimestamp && (
          <span className="text-[10px] text-discord-text-muted"> (編集済み)</span>
        )}
      </>
    );
  };

  return (
    <div
      className={cn(
        "group relative px-4",
        isGrouped ? "py-0.5" : "mt-[1.0625rem] py-0.5",
        hovered && "bg-discord-bg-mod-hover",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={handleContextMenu}
    >
      {hovered && !editing && (
        <MessageActions message={message} channelId={message.channelId} onEdit={startEditing} />
      )}

      {message.referencedMessage && (
        <div className="pl-[52px]">
          <MessageReply referencedMessage={message.referencedMessage} />
        </div>
      )}

      {isGrouped ? (
        <div className="relative pl-[52px]">
          <span
            className={cn(
              "absolute left-0 w-[52px] text-right pr-3",
              "text-[11px] leading-[1.375rem] text-discord-text-muted",
              "opacity-0 select-none",
              hovered && "opacity-100",
            )}
          >
            {formatShortTimestamp(message.timestamp)}
          </span>
          {renderContent()}
          {!editing && (
            <>
              {message.attachments.map((attachment) => (
                <MessageAttachment key={attachment.id} attachment={attachment} />
              ))}
              {message.embeds.map((embed, i) => (
                <MessageEmbed key={i} embed={embed} />
              ))}
              <MessageReactions reactions={message.reactions} />
              {message.components && message.components.length > 0 && (
                <BotComponents components={message.components} />
              )}
              {ephemeral && <EphemeralBanner onDismiss={() => setDismissed(true)} />}
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <button className="mt-0.5 shrink-0" onClick={handleProfileClick}>
            <Avatar
              src={message.author.avatar ?? undefined}
              alt={message.author.displayName}
              size={40}
              className="cursor-pointer"
            />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <button
                onClick={handleProfileClick}
                className="cursor-pointer font-medium text-discord-header-primary hover:underline"
              >
                {message.author.displayName}
              </button>
              <span className="text-xs text-discord-text-muted">
                {formatMessageTimestamp(message.timestamp)}
              </span>
            </div>
            {renderContent()}
            {!editing && (
              <>
                {message.attachments.map((attachment) => (
                  <MessageAttachment key={attachment.id} attachment={attachment} />
                ))}
                {message.embeds.map((embed, i) => (
                  <MessageEmbed key={i} embed={embed} />
                ))}
                <MessageReactions reactions={message.reactions} />
                {message.components && message.components.length > 0 && (
                  <BotComponents components={message.components} />
                )}
                {ephemeral && <EphemeralBanner onDismiss={() => setDismissed(true)} />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
