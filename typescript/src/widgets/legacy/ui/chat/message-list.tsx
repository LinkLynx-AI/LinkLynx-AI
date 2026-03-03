"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import type { Message as MessageType } from "@/shared/model/legacy/types/message";
import { Message } from "./message";
import { DateSeparator } from "./date-separator";
import { WelcomeMessage } from "./welcome-message";
import { ScrollToBottom } from "./scroll-to-bottom";
import { MessageSkeletonList } from "@/shared/ui/legacy/message-skeleton";

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
}: {
  messages: MessageType[];
  channelName: string;
  isLoading?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  }, []);

  return (
    <div className="relative flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn("discord-scrollbar absolute inset-0 overflow-y-auto", "flex flex-col")}
      >
        <div className="mt-auto">
          <WelcomeMessage channelName={channelName} />

          {isLoading && <MessageSkeletonList />}

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
