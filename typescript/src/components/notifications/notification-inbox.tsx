"use client";

import { useState, useMemo, useCallback } from "react";
import { X, CheckCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tabs } from "@/components/ui/tabs";
import { NotificationItem } from "./notification-item";
import { MOCK_NOTIFICATIONS } from "./notification-mock-data";

const TABS = [
  { id: "for-you", label: "For You" },
  { id: "unread", label: "未読" },
  { id: "mentions", label: "メンション" },
];

export function NotificationInbox({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState("for-you");
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case "unread":
        return notifications.filter((n) => !n.read);
      case "mentions":
        return notifications.filter((n) => n.type === "mention");
      default:
        return notifications;
    }
  }, [activeTab, notifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className={cn("flex h-full flex-col", "bg-discord-bg-secondary")}>
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-discord-header-separator px-4">
        <h2 className="font-semibold text-discord-header-primary">受信トレイ</h2>
        <div className="flex items-center gap-1">
          {hasUnread && (
            <button
              onClick={markAllAsRead}
              className={cn(
                "rounded p-1 text-discord-interactive-normal",
                "hover:text-discord-interactive-hover transition-colors",
              )}
              aria-label="全て既読にする"
              title="全て既読にする"
            >
              <CheckCheck className="h-5 w-5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                "rounded p-1 text-discord-interactive-normal",
                "hover:text-discord-interactive-hover transition-colors",
              )}
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-2">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-discord-text-muted">
            <p className="text-sm">通知はありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
