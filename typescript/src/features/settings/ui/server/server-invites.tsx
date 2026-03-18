"use client";

import { useState } from "react";
import { useRevokeInvite } from "@/shared/api/mutations";
import { useInvites } from "@/shared/api/queries/use-invites";
import { toDeleteActionErrorText } from "@/shared/api/guild-channel-api-client";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { Button } from "@/shared/ui/button";

function formatDateTime(value: string | null): string {
  if (value === null) {
    return "無期限";
  }

  return new Date(value).toLocaleString("ja-JP");
}

export function ServerInvites({ serverId }: { serverId: string }) {
  const addToast = useUIStore((state) => state.addToast);
  const invitesQuery = useInvites(serverId);
  const revokeInvite = useRevokeInvite();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pendingInviteCode = revokeInvite.variables?.inviteCode ?? null;

  const handleRevoke = async (inviteCode: string) => {
    setSubmitError(null);

    try {
      await revokeInvite.mutateAsync({ serverId, inviteCode });
      addToast({ message: "招待を取り消しました。", type: "success" });
    } catch (error: unknown) {
      setSubmitError(toDeleteActionErrorText(error, "招待の取消に失敗しました。"));
    }
  };

  const invites = invitesQuery.data ?? [];
  const errorMessage =
    submitError ?? (invitesQuery.error instanceof Error ? invitesQuery.error.message : null);

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">招待</h2>
      <p className="mb-4 text-sm text-discord-text-muted">
        guild-wide admin view として、アクティブな招待を招待先チャンネル付きで表示します。
      </p>

      {errorMessage !== null && (
        <div className="mb-4 rounded bg-discord-brand-red/10 px-3 py-2 text-sm text-discord-brand-red">
          {errorMessage}
        </div>
      )}

      {invitesQuery.isPending ? (
        <div className="py-10 text-center">
          <p className="text-sm text-discord-text-muted">招待を読み込んでいます...</p>
        </div>
      ) : invites.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-discord-text-muted">有効な招待はありません</p>
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm text-discord-text-muted">{invites.length} 件の招待</div>

          <div className="flex items-center gap-3 border-b border-discord-divider px-3 py-2 text-xs font-bold uppercase text-discord-header-secondary">
            <span className="w-[120px]">コード</span>
            <span className="w-[140px]">チャンネル</span>
            <span className="flex-1">作成者</span>
            <span className="w-[80px] text-center">使用回数</span>
            <span className="w-[150px]">有効期限</span>
            <span className="w-[150px]">作成日時</span>
            <span className="w-[80px]" />
          </div>

          <div>
            {invites.map((invite) => {
              const isPending =
                revokeInvite.isPending &&
                pendingInviteCode !== null &&
                pendingInviteCode === invite.code;

              return (
                <div
                  key={invite.code}
                  className="flex items-center gap-3 border-b border-discord-divider px-3 py-2.5 transition-colors hover:bg-discord-bg-mod-hover"
                >
                  <span className="w-[120px] truncate text-sm font-mono text-discord-text-link">
                    {invite.code}
                  </span>
                  <span className="w-[140px] truncate text-sm text-discord-text-normal">
                    {invite.channel === null ? "不明" : `#${invite.channel.name}`}
                  </span>
                  <span className="flex-1 truncate text-sm text-discord-text-normal">
                    {invite.creator?.displayName ?? "不明"}
                  </span>
                  <span className="w-[80px] text-center text-sm text-discord-text-muted">
                    {invite.uses}
                    {invite.maxUses !== null ? `/${invite.maxUses}` : ""}
                  </span>
                  <span className="w-[150px] text-sm text-discord-text-muted">
                    {formatDateTime(invite.expiresAt)}
                  </span>
                  <span className="w-[150px] text-sm text-discord-text-muted">
                    {formatDateTime(invite.createdAt)}
                  </span>
                  <span className="w-[80px]">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={revokeInvite.isPending}
                      onClick={() => handleRevoke(invite.code)}
                    >
                      {isPending ? "取消中..." : "取消"}
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
