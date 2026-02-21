"use client";

import { useEffect, useRef, useState } from "react";
import { MemberAvatar } from "@/entities";
import {
  MessageDeliveryStatus,
  ThemeToggleButton,
  UnreadJumpButton,
  type MessageDeliveryState,
} from "@/features";
import { classNames } from "@/shared";
import { AppShellFrame } from "@/widgets";

type DemoMessage = {
  id: string;
  authorName: string;
  body: string;
  isOwn: boolean;
  deliveryState?: MessageDeliveryState;
};

const demoMember = {
  id: "member-1",
  displayName: "LinkLynx Bot",
  statusLabel: "Online",
  avatarLabel: "LB",
};

const retryTargetMessageId = "message-2";
const retryCompletionDelayMs = 800;

const initialMessages: DemoMessage[] = [
  {
    id: "message-1",
    authorName: "LinkLynx Bot",
    body: "pending / failed / retry の状態遷移をモックで確認してください。",
    isOwn: false,
  },
  {
    id: retryTargetMessageId,
    authorName: "You",
    body: "このメッセージは送信失敗しています。",
    isOwn: true,
    deliveryState: "failed",
  },
];

function updateDeliveryState(
  messages: DemoMessage[],
  messageId: string,
  deliveryState: MessageDeliveryState
): DemoMessage[] {
  return messages.map((message) =>
    message.id === messageId
      ? {
          ...message,
          deliveryState,
        }
      : message
  );
}

export default function Home() {
  const [messages, setMessages] = useState<DemoMessage[]>(initialMessages);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const handleRetry = () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }

    setMessages((current) => updateDeliveryState(current, retryTargetMessageId, "pending"));
    retryTimerRef.current = window.setTimeout(() => {
      setMessages((current) => updateDeliveryState(current, retryTargetMessageId, "sent"));
      retryTimerRef.current = null;
    }, retryCompletionDelayMs);
  };

  const handleMockIncoming = () => {
    setUnreadCount((current) => current + 1);
    setIsAtBottom(false);
  };

  const handleJumpToLatest = () => {
    setIsAtBottom(true);
    setUnreadCount(0);
  };

  return (
    <AppShellFrame
      headerSlot={
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-discord-primary">LinkLynx</h1>
          <ThemeToggleButton currentTheme="dark" disabled />
        </div>
      }
      sidebarSlot={
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Members
          </h2>
          <MemberAvatar member={demoMember} />
        </div>
      }
      contentSlot={
        <article className="space-y-5">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold">送信状態と新着導線のモック</h2>
            <p className="text-sm text-white/75">
              failed時の再送導線と、新着ジャンプ表示条件を画面上で確認できます。
            </p>
          </header>

          <section className="space-y-3 rounded-lg border border-white/10 bg-discord-dark/40 p-4">
            <h3 className="text-sm font-semibold text-white/80">Message timeline</h3>
            <div className="space-y-3">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={classNames(
                    "max-w-[85%] space-y-2 rounded-lg border px-3 py-2",
                    message.isOwn
                      ? "ml-auto border-discord-primary/40 bg-discord-primary/15"
                      : "border-white/10 bg-discord-dark"
                  )}
                >
                  <p className="text-xs font-semibold text-white/70">{message.authorName}</p>
                  <p className="text-sm text-white">{message.body}</p>
                  {message.isOwn && message.deliveryState ? (
                    <MessageDeliveryStatus
                      state={message.deliveryState}
                      {...(message.deliveryState === "failed"
                        ? { onRetry: handleRetry }
                        : {})}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-white/10 bg-discord-dark/40 p-4">
            <h3 className="text-sm font-semibold text-white/80">Unread jump mock controls</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleMockIncoming}
                className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                新着を追加
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAtBottom((current) => !current);
                }}
                className="rounded-md border border-white/20 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                スクロール位置: {isAtBottom ? "最下部" : "途中"}
              </button>
              <p className="text-xs text-white/65">未読件数: {unreadCount}</p>
            </div>
            <UnreadJumpButton
              isAtBottom={isAtBottom}
              unreadCount={unreadCount}
              onJumpToLatest={handleJumpToLatest}
            />
          </section>
        </article>
      }
    />
  );
}
