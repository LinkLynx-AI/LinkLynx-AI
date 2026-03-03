"use client";

import { useState } from "react";
import { Trash2, Link } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Invite {
  id: string;
  code: string;
  creator: string;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
}

const mockInvites: Invite[] = [
  {
    id: "inv1",
    code: "abc123",
    creator: "太郎",
    uses: 5,
    maxUses: 10,
    expiresAt: "2026-04-01",
  },
  {
    id: "inv2",
    code: "xyz789",
    creator: "花子",
    uses: 12,
    maxUses: null,
    expiresAt: null,
  },
  {
    id: "inv3",
    code: "qwe456",
    creator: "次郎",
    uses: 0,
    maxUses: 5,
    expiresAt: "2026-03-15",
  },
];

export function ChannelEditInvites({
  channelId,
}: {
  channelId?: string;
}) {
  const [invites, setInvites] = useState<Invite[]>(mockInvites);

  const handleRevoke = (id: string) => {
    setInvites((prev) => prev.filter((inv) => inv.id !== id));
  };

  if (invites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Link className="mb-3 h-10 w-10 text-discord-text-muted" />
        <p className="text-sm font-medium text-discord-text-normal">
          招待がありません
        </p>
        <p className="mt-1 text-xs text-discord-text-muted">
          このチャンネルにはアクティブな招待がありません
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 px-2 text-xs font-bold uppercase text-discord-header-secondary">
        <span>招待コード</span>
        <span>作成者</span>
        <span>使用回数</span>
        <span>有効期限</span>
        <span />
      </div>
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="grid grid-cols-[1fr_80px_80px_80px_40px] items-center gap-2 rounded bg-discord-bg-secondary px-2 py-2"
        >
          <span className="text-sm font-mono text-discord-text-normal">
            {invite.code}
          </span>
          <span className="text-sm text-discord-text-muted">
            {invite.creator}
          </span>
          <span className="text-sm text-discord-text-muted">
            {invite.uses}
            {invite.maxUses ? ` / ${invite.maxUses}` : ""}
          </span>
          <span className="text-sm text-discord-text-muted">
            {invite.expiresAt ?? "無期限"}
          </span>
          <Button
            variant="danger"
            size="sm"
            className="h-7 w-7 !p-0"
            onClick={() => handleRevoke(invite.id)}
            aria-label="招待を取り消す"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
