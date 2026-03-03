"use client";

import { useState } from "react";
import { Webhook, Plus, Copy, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/legacy/button";
import { Toggle } from "@/shared/ui/legacy/toggle";

type WebhookItem = {
  id: string;
  name: string;
  avatar: string | null;
  url: string;
};

const mockWebhooks: WebhookItem[] = [];

export function ChannelEditIntegrations({ channelId }: { channelId?: string }) {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>(mockWebhooks);
  const [followEnabled, setFollowEnabled] = useState(false);

  const handleDeleteWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="space-y-6">
      {/* Webhooks section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase text-discord-header-secondary">Webhook</h3>
          <Button size="sm" variant="primary">
            <Plus className="mr-1 h-3.5 w-3.5" />
            新規作成
          </Button>
        </div>
        {webhooks.length === 0 ? (
          <div className="rounded bg-discord-bg-secondary px-3 py-4 text-center text-sm text-discord-text-muted">
            Webhookがありません
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex items-center gap-3 rounded bg-discord-bg-secondary px-3 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-discord-bg-tertiary">
                  <Webhook className="h-4 w-4 text-discord-interactive-normal" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-discord-text-normal">{webhook.name}</div>
                  <div className="truncate text-xs text-discord-text-muted">{webhook.url}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyUrl(webhook.url)}
                    className="rounded p-1.5 text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-interactive-hover"
                    aria-label="URLをコピー"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(webhook.id)}
                    className="rounded p-1.5 text-discord-interactive-normal hover:bg-discord-bg-mod-hover hover:text-discord-brand-red"
                    aria-label="Webhookを削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Channel following section */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          チャンネルフォロー
        </h3>
        <div className="flex items-center justify-between rounded bg-discord-bg-secondary px-3 py-3">
          <div>
            <div className="text-sm font-medium text-discord-text-normal">
              アナウンスチャンネルのフォロー
            </div>
            <div className="text-xs text-discord-text-muted">
              このチャンネルでアナウンスチャンネルをフォローして更新を受け取ります
            </div>
          </div>
          <Toggle checked={followEnabled} onChange={setFollowEnabled} />
        </div>
      </div>
    </div>
  );
}
