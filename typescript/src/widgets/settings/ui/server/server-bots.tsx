"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/legacy/button";
import { Avatar } from "@/shared/ui/legacy/avatar";
import { ExternalLink, Shield, Trash2, Bot } from "lucide-react";

type BotData = {
  id: string;
  name: string;
  avatar: string | null;
  description: string;
  permissions: string[];
  addedAt: string;
};

const mockBots: BotData[] = [];

export function ServerBots({ serverId }: { serverId: string }) {
  const [bots, setBots] = useState<BotData[]>(mockBots);

  const handleRemove = (botId: string) => {
    setBots((prev) => prev.filter((b) => b.id !== botId));
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-discord-header-primary">ボット</h2>
        <Button>
          <ExternalLink className="mr-1.5 h-4 w-4" />
          ボットを追加
        </Button>
      </div>

      <p className="mb-6 text-sm text-discord-text-muted">
        このサーバーに追加されたボットを管理します。
      </p>

      {bots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot className="mb-3 h-12 w-12 text-discord-interactive-muted" />
          <p className="text-sm font-medium text-discord-text-normal">
            ボットはまだ追加されていません
          </p>
          <p className="mt-1 text-xs text-discord-text-muted">
            App Directoryからボットを追加して、サーバーを強化しましょう。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => (
            <div key={bot.id} className="rounded-lg bg-discord-bg-secondary p-4">
              <div className="flex items-start gap-4">
                <Avatar src={bot.avatar ?? undefined} alt={bot.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-discord-text-normal">{bot.name}</h3>
                    <span className="rounded bg-discord-brand-blurple/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-discord-brand-blurple">
                      BOT
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-discord-text-muted leading-relaxed">
                    {bot.description}
                  </p>
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-bold uppercase text-discord-header-secondary">
                      権限
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {bot.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="rounded bg-discord-bg-tertiary px-2 py-0.5 text-xs text-discord-text-muted"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-discord-text-muted">
                    追加日: {new Date(bot.addedAt).toLocaleDateString("ja-JP")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-discord-divider pt-3">
                <Button variant="secondary" size="sm">
                  <Shield className="mr-1.5 h-3.5 w-3.5" />
                  権限を管理
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleRemove(bot.id)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  削除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
