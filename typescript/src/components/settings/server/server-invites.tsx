"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { mockInvites } from "@/services/mock/data/invites";
import type { Invite } from "@/services/mock/data/invites";

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "無期限";
  const date = new Date(expiresAt);
  return date.toLocaleDateString("ja-JP");
}

export function ServerInvites({ serverId }: { serverId: string }) {
  const [invites, setInvites] = useState<Invite[]>(mockInvites);

  function revokeInvite(code: string) {
    setInvites((prev) => prev.filter((inv) => inv.code !== code));
  }

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">招待</h2>

      {invites.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-discord-text-muted">有効な招待はありません</p>
        </div>
      ) : (
        <>
          <div className="text-sm text-discord-text-muted mb-3">{invites.length} 件の招待</div>

          {/* Header row */}
          <div className="flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase text-discord-header-secondary border-b border-discord-divider">
            <span className="w-[100px]">コード</span>
            <span className="w-[120px]">チャンネル</span>
            <span className="flex-1">作成者</span>
            <span className="w-[80px] text-center">使用回数</span>
            <span className="w-[100px]">有効期限</span>
            <span className="w-[80px]" />
          </div>

          <div>
            {invites.map((invite) => (
              <div
                key={invite.code}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-discord-divider hover:bg-discord-bg-mod-hover transition-colors"
              >
                <span className="w-[100px] truncate text-sm font-mono text-discord-text-link">
                  {invite.code}
                </span>
                <span className="w-[120px] truncate text-sm text-discord-text-normal">
                  {invite.channelName}
                </span>
                <span className="flex-1 truncate text-sm text-discord-text-normal">
                  {invite.creatorUsername}
                </span>
                <span className="w-[80px] text-center text-sm text-discord-text-muted">
                  {invite.uses}
                  {invite.maxUses !== null ? `/${invite.maxUses}` : ""}
                </span>
                <span className="w-[100px] text-sm text-discord-text-muted">
                  {formatExpiry(invite.expiresAt)}
                </span>
                <span className="w-[80px]">
                  <Button variant="danger" size="sm" onClick={() => revokeInvite(invite.code)}>
                    取消
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
