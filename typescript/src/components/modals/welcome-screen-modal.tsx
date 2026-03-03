"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

const mockRecommendedChannels = [
  { id: "1", emoji: "👋", name: "挨拶", description: "自己紹介をしましょう！" },
  { id: "2", emoji: "💬", name: "雑談", description: "自由におしゃべり" },
  { id: "3", emoji: "📢", name: "お知らせ", description: "重要なアナウンス" },
  { id: "4", emoji: "🎮", name: "ゲーム", description: "ゲームの話題はこちら" },
  { id: "5", emoji: "🎵", name: "音楽", description: "おすすめの音楽をシェア" },
  { id: "6", emoji: "💻", name: "プログラミング", description: "コードについて語ろう" },
];

export function WelcomeScreenModal({
  onClose,
  serverId,
}: {
  onClose: () => void;
  serverId?: string;
}) {
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    new Set(mockRecommendedChannels.map((c) => c.id)),
  );

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  return (
    <Modal open onClose={onClose} className="max-w-[700px]">
      {/* Header area */}
      <div className="px-6 pt-6 pb-4 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-discord-brand-blurple text-2xl font-bold text-white">
          S
        </div>
        <h2 className="text-2xl font-bold text-discord-header-primary">サーバーへようこそ！</h2>
        <p className="mt-1 text-sm text-discord-text-muted">
          参加するチャンネルを選んで、コミュニティに参加しましょう。
        </p>
      </div>

      {/* Recommended channels */}
      <div className="px-6 pb-4">
        <div className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          おすすめのチャンネル
        </div>
        <div className="grid grid-cols-2 gap-2">
          {mockRecommendedChannels.map((channel) => {
            const isSelected = selectedChannels.has(channel.id);
            return (
              <button
                key={channel.id}
                onClick={() => toggleChannel(channel.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-discord-brand-blurple bg-discord-brand-blurple/10"
                    : "border-discord-divider bg-discord-bg-secondary hover:bg-discord-bg-mod-hover",
                )}
              >
                <span className="mt-0.5 text-xl">{channel.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-discord-header-primary">
                    {channel.name}
                  </div>
                  <div className="text-xs text-discord-text-muted">{channel.description}</div>
                </div>
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded",
                    isSelected
                      ? "bg-discord-brand-blurple text-white"
                      : "border-2 border-discord-interactive-normal",
                  )}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ModalFooter>
        <button
          onClick={onClose}
          className="rounded bg-discord-brand-blurple px-6 py-2 text-sm font-medium text-white hover:bg-discord-brand-blurple/80"
        >
          完了
        </button>
      </ModalFooter>
    </Modal>
  );
}
