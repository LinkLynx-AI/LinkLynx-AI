"use client";

import { Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

export function CallScreen({
  type,
  callerName,
  callerAvatar,
  onAccept,
  onDecline,
}: {
  type: "incoming" | "outgoing";
  callerName: string;
  callerAvatar?: string;
  onAccept?: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-discord-bg-tertiary">
      {/* Pulsing ring avatar */}
      <div className="relative mb-6">
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            type === "incoming"
              ? "animate-ping bg-discord-btn-success/30"
              : "animate-ping bg-discord-brand-blurple/30"
          )}
          style={{ animationDuration: "2s" }}
        />
        <div
          className={cn(
            "absolute -inset-2 rounded-full",
            type === "incoming"
              ? "animate-pulse bg-discord-btn-success/20"
              : "animate-pulse bg-discord-brand-blurple/20"
          )}
        />
        <Avatar
          src={callerAvatar}
          alt={callerName}
          size={80}
        />
      </div>

      {/* Caller name */}
      <h2 className="mb-2 text-xl font-semibold text-discord-header-primary">
        {callerName}
      </h2>

      {/* Status text */}
      <p className="mb-8 text-sm text-discord-text-muted">
        {type === "incoming" ? "着信中..." : "発信中..."}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-6">
        {type === "incoming" && (
          <button
            onClick={onAccept}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-discord-btn-success text-white shadow-lg transition-transform hover:scale-105"
            aria-label="応答"
          >
            <Phone className="h-6 w-6" />
          </button>
        )}

        <button
          onClick={onDecline}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-discord-btn-danger text-white shadow-lg transition-transform hover:scale-105"
          aria-label={type === "incoming" ? "拒否" : "キャンセル"}
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
