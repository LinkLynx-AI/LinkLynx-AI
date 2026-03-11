"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { Message as MessageType } from "@/shared/model/types/message";
import { Message } from "./message";
import { DateSeparator } from "./date-separator";
import { WelcomeMessage } from "./welcome-message";
import { ScrollToBottom } from "./scroll-to-bottom";
import { MessageSkeletonList } from "@/shared/ui/message-skeleton";

const GROUPING_THRESHOLD_MS = 7 * 60 * 1000; // 7 minutes

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function shouldGroup(prev: MessageType, curr: MessageType): boolean {
  if (prev.author.id !== curr.author.id) return false;
  const diff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
  if (diff > GROUPING_THRESHOLD_MS) return false;
  if (curr.referencedMessage) return false;
  // System messages should not be grouped
  if (curr.type !== 0 && curr.type !== 19) return false;
  return true;
}

export function MessageList({
  messages,
  channelName,
  isLoading,
  errorMessage,
  hasMore,
  isLoadingMore,
  loadMoreErrorMessage,
  onLoadMore,
  scrollToBottomToken,
}: {
  messages: MessageType[];
  channelName: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  loadMoreErrorMessage?: string | null;
  onLoadMore?: () => Promise<void>;
  scrollToBottomToken?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const shouldStickToBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }

    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
    setShowScrollBtn(false);
    scrollToBottom();
  }, [scrollToBottom, scrollToBottomToken]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickToBottomRef.current = distFromBottom < 200;
    setShowScrollBtn(distFromBottom > 200);
  }, []);

  const handleLoadMore = useCallback(async () => {
    const el = scrollRef.current;
    if (el === null || onLoadMore === undefined) {
      return;
    }

    const previousScrollHeight = el.scrollHeight;
    const previousScrollTop = el.scrollTop;
    shouldStickToBottomRef.current = false;
    await onLoadMore();

    window.requestAnimationFrame(() => {
      const nextElement = scrollRef.current;
      if (nextElement === null) {
        return;
      }

      const nextScrollHeight = nextElement.scrollHeight;
      nextElement.scrollTop = previousScrollTop + (nextScrollHeight - previousScrollHeight);
    });
  }, [onLoadMore]);

  return (
    <div className="relative flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn("discord-scrollbar absolute inset-0 overflow-y-auto", "flex flex-col")}
      >
        <div className="mt-auto">
          <WelcomeMessage channelName={channelName} />

          {hasMore && (
            <div className="px-4 py-3">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={isLoadingMore || onLoadMore === undefined}
                  className={cn(
                    "rounded-md border border-discord-border-subtle px-3 py-1.5 text-xs font-medium",
                    "text-discord-text-muted transition-colors hover:bg-discord-bg-mod-hover hover:text-discord-text-normal",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  {isLoadingMore ? "読み込み中..." : "過去のメッセージを読み込む"}
                </button>
              </div>
              {loadMoreErrorMessage !== null && loadMoreErrorMessage !== undefined && (
                <p className="mt-2 text-center text-xs text-discord-brand-red">
                  {loadMoreErrorMessage}
                </p>
              )}
            </div>
          )}

          {isLoading && <MessageSkeletonList />}
          {errorMessage !== null && errorMessage !== undefined && !isLoading && (
            <div className="px-4 py-6">
              <p className="text-center text-sm text-discord-brand-red">{errorMessage}</p>
            </div>
          )}

          {messages.map((message, index) => {
            const prev = index > 0 ? messages[index - 1] : null;
            const isGrouped = prev ? shouldGroup(prev, message) : false;
            const needsDateSep = prev && !isSameDay(prev.timestamp, message.timestamp);

            return (
              <div key={message.id}>
                {needsDateSep && <DateSeparator date={message.timestamp} />}
                <Message message={message} isGrouped={isGrouped} />
              </div>
            );
          })}

          <div className="h-6" />
        </div>
      </div>

      <ScrollToBottom visible={showScrollBtn} onClick={scrollToBottom} />
    </div>
  );
}
