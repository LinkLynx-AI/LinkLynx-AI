"use client";

import { useState, useCallback, useRef, type KeyboardEvent } from "react";
import { X, Users, CirclePlus, Smile, Bell, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { formatMessageTimestamp, formatShortTimestamp } from "@/lib/format-date";
import type { Message } from "@/types/message";
import { mockThreadMessages } from "./thread-mock-data";
import { ThreadMembersPopout, type ThreadMember } from "./thread-members-popout";
import { ThreadNotificationMenu } from "./thread-notification-menu";
import { ThreadArchiveBanner } from "./thread-archive-banner";
import { ThreadSearch } from "./thread-search";
import { mockUsers } from "@/services/mock/data/users";

const mockThreadMembers: ThreadMember[] = mockUsers.slice(0, 5).map((u) => ({
  userId: u.id,
  displayName: u.displayName,
  avatar: u.avatar,
}));

export function ThreadView({
  threadId,
  threadName,
  parentMessage,
  memberCount = 5,
  isArchived = false,
  isLocked = false,
  onClose,
}: {
  threadId: string;
  threadName: string;
  parentMessage?: Message;
  memberCount?: number;
  isArchived?: boolean;
  isLocked?: boolean;
  onClose?: () => void;
}) {
  const [content, setContent] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [notificationSetting, setNotificationSetting] = useState<"all" | "mentions" | "nothing">("all");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, []);

  return (
    <div className="flex h-full flex-col bg-discord-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-discord-divider px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-discord-header-primary">
            {threadName}
          </h2>
          <span className="flex items-center gap-1 rounded bg-discord-bg-accent/20 px-1.5 py-0.5 text-xs text-discord-text-muted">
            <Users className="h-3 w-3" />
            {memberCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowNotificationMenu(!showNotificationMenu)}
              className={cn(
                "rounded p-1.5 transition-colors",
                "text-discord-interactive-normal hover:text-discord-interactive-hover"
              )}
              aria-label="通知設定"
            >
              <Bell className="h-4 w-4" />
            </button>
            {showNotificationMenu && (
              <ThreadNotificationMenu
                currentSetting={notificationSetting}
                onChange={setNotificationSetting}
                onClose={() => setShowNotificationMenu(false)}
              />
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMembers(!showMembers)}
              className={cn(
                "rounded p-1.5 transition-colors",
                "text-discord-interactive-normal hover:text-discord-interactive-hover"
              )}
              aria-label="メンバー"
            >
              <Users className="h-4 w-4" />
            </button>
            {showMembers && (
              <ThreadMembersPopout
                threadId={threadId}
                members={mockThreadMembers}
                onAddMember={() => {}}
                onRemoveMember={() => {}}
                onClose={() => setShowMembers(false)}
              />
            )}
          </div>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "rounded p-1.5 transition-colors",
              "text-discord-interactive-normal hover:text-discord-interactive-hover"
            )}
            aria-label="検索"
          >
            <Search className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-1.5 text-discord-interactive-normal hover:text-discord-interactive-hover transition-colors"
              aria-label="スレッドを閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Thread search */}
      {showSearch && (
        <ThreadSearch
          threadId={threadId}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {/* Parent message quote */}
        {parentMessage && (
          <div className="mx-4 mt-4 rounded-lg border border-discord-divider bg-discord-bg-secondary p-3">
            <div className="flex items-center gap-2">
              <Avatar
                src={parentMessage.author.avatar ?? undefined}
                alt={parentMessage.author.displayName}
                size={16}
              />
              <span className="text-sm font-medium text-discord-header-primary">
                {parentMessage.author.displayName}
              </span>
            </div>
            <p className="mt-1 text-sm text-discord-text-normal">
              {parentMessage.content}
            </p>
          </div>
        )}

        {/* System message */}
        <div className="px-4 py-3">
          <p className="text-sm text-discord-text-muted">
            ユーザーがスレッドを開始しました
          </p>
        </div>

        {/* Thread messages */}
        {mockThreadMessages.map((message, index) => {
          const prevMessage = index > 0 ? mockThreadMessages[index - 1] : null;
          const isGrouped =
            !!prevMessage && prevMessage.author.id === message.author.id;

          return (
            <div
              key={message.id}
              className={cn(
                "group relative px-4",
                isGrouped ? "py-0.5" : "mt-[1.0625rem] py-0.5"
              )}
            >
              {isGrouped ? (
                <div className="pl-[52px]">
                  <p className="text-discord-text-normal">{message.content}</p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    <Avatar
                      src={message.author.avatar ?? undefined}
                      alt={message.author.displayName}
                      size={40}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-discord-header-primary">
                        {message.author.displayName}
                      </span>
                      <span className="text-xs text-discord-text-muted">
                        {formatMessageTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-discord-text-normal">{message.content}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Archive/Lock banner */}
      <ThreadArchiveBanner
        isArchived={isArchived}
        isLocked={isLocked}
      />

      {/* Message input */}
      <div className={cn("px-4 pb-4", isLocked && "pointer-events-none opacity-50")}>
        <div className="flex items-end gap-0 rounded-lg bg-discord-input-bg">
          <button
            className={cn(
              "shrink-0 p-2.5",
              "text-discord-interactive-normal hover:text-discord-interactive-hover",
              "transition-colors"
            )}
            disabled={isLocked}
          >
            <CirclePlus className="h-5 w-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={`${threadName} にメッセージを送信`}
            rows={1}
            disabled={isLocked}
            className={cn(
              "max-h-[300px] min-h-[24px] flex-1 resize-none",
              "bg-transparent py-2.5 text-base text-discord-text-normal",
              "placeholder:text-discord-text-muted",
              "outline-none"
            )}
          />
          <button
            className={cn(
              "shrink-0 p-2.5",
              "text-discord-interactive-normal hover:text-discord-interactive-hover",
              "transition-colors"
            )}
            disabled={isLocked}
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
