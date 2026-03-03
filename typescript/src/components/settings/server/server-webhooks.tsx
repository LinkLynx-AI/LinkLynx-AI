"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { mockWebhooks, type WebhookData } from "@/services/mock/data/webhooks";
import { Copy, Trash2, ChevronDown, Upload } from "lucide-react";

const channelOptions = [
  { value: "ch-1", label: "#dev-updates" },
  { value: "ch-2", label: "#deployments" },
  { value: "ch-3", label: "#news" },
  { value: "ch-general", label: "#general" },
];

const webhookColors = ["#5865F2", "#57F287", "#FEE75C", "#EB459E", "#ED4245"];

function WebhookItem({
  webhook,
  onDelete,
}: {
  webhook: WebhookData;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(webhook.name);
  const [channel, setChannel] = useState(webhook.channelId);
  const [copied, setCopied] = useState(false);
  const color = webhookColors[parseInt(webhook.id.replace("wh-", "")) % webhookColors.length];

  const webhookUrl = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg bg-discord-bg-secondary">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold"
          style={{ backgroundColor: color }}
        >
          {webhook.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-discord-text-normal truncate">
            {webhook.name}
          </p>
          <p className="text-xs text-discord-text-muted">
            #{webhook.channelName} ・ 作成日: {new Date(webhook.createdAt).toLocaleDateString("ja-JP")}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-discord-interactive-normal transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-discord-divider px-4 pb-4 pt-3 space-y-4">
          <Input
            label="名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
              チャンネル
            </label>
            <Select
              options={channelOptions}
              value={channel}
              onChange={setChannel}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
              アバター
            </label>
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-discord-interactive-muted cursor-pointer hover:border-discord-interactive-hover transition-colors">
              <Upload className="h-5 w-5 text-discord-interactive-muted" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
              Webhook URL
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-[3px] bg-discord-input-bg px-3 py-2 text-xs text-discord-text-muted font-mono">
                {webhookUrl}
              </div>
              <Button variant="secondary" size="sm" onClick={handleCopyUrl}>
                <Copy className="h-4 w-4 mr-1" />
                {copied ? "コピー済み" : "コピー"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button variant="success" size="sm">
              変更を保存
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete(webhook.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              削除
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ServerWebhooks({ serverId }: { serverId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookData[]>(mockWebhooks);

  const handleDelete = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const handleCreate = () => {
    const newWebhook: WebhookData = {
      id: `wh-${Date.now()}`,
      name: "新しいWebhook",
      channelId: "ch-general",
      channelName: "general",
      avatar: null,
      token: Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
      lastUsed: null,
    };
    setWebhooks((prev) => [...prev, newWebhook]);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-discord-header-primary">
          Webhook
        </h2>
        <Button onClick={handleCreate}>新しいWebhookを作成</Button>
      </div>

      <p className="mb-4 text-sm text-discord-text-muted">
        Webhookを使用して、外部サービスからこのサーバーにメッセージを送信できます。
      </p>

      <div className="space-y-2">
        {webhooks.map((webhook) => (
          <WebhookItem
            key={webhook.id}
            webhook={webhook}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {webhooks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-discord-text-muted">
            Webhookはまだありません
          </p>
        </div>
      )}
    </div>
  );
}
