"use client";

import { useState } from "react";
import { Link, Trash2 } from "lucide-react";
import { useRevokeInvite } from "@/shared/api/mutations";
import { useInvites } from "@/shared/api/queries/use-invites";
import { toApiErrorText, toDeleteActionErrorText } from "@/shared/api/guild-channel-api-client";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { Button } from "@/shared/ui/button";

function formatDateTime(value: string | null): string {
  if (value === null) {
    return "無期限";
  }

  return new Date(value).toLocaleString("ja-JP");
}

export function ChannelEditInvites({
  serverId,
  channelId,
}: {
  serverId?: string;
  channelId?: string;
}) {
  const addToast = useUIStore((state) => state.addToast);
  const normalizedChannelId = channelId?.trim() || undefined;
  const invitesQuery = useInvites(serverId ?? "", normalizedChannelId);
  const revokeInvite = useRevokeInvite();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pendingInviteCode = revokeInvite.variables?.inviteCode ?? null;

  const handleRevoke = async (inviteCode: string) => {
    if (serverId === undefined || serverId.trim().length === 0) {
      setSubmitError("サーバー情報を解決できないため、招待を取り消せません。");
      return;
    }
    if (normalizedChannelId === undefined) {
      setSubmitError("チャンネル情報を解決できないため、招待を取り消せません。");
      return;
    }

    setSubmitError(null);

    try {
      await revokeInvite.mutateAsync({ serverId, inviteCode, channelId: normalizedChannelId });
      addToast({ message: "招待を取り消しました。", type: "success" });
    } catch (error: unknown) {
      setSubmitError(toDeleteActionErrorText(error, "招待の取消に失敗しました。"));
    }
  };

  const invites = invitesQuery.data ?? [];
  const errorMessage =
    submitError ??
    (invitesQuery.error == null
      ? null
      : toApiErrorText(invitesQuery.error, "招待一覧の取得に失敗しました。"));

  if (invitesQuery.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Link className="mb-3 h-10 w-10 text-discord-text-muted" />
        <p className="text-sm font-medium text-discord-text-normal">招待を読み込んでいます</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorMessage !== null && (
        <div className="rounded bg-discord-brand-red/10 px-3 py-2 text-sm text-discord-brand-red">
          {errorMessage}
        </div>
      )}

      {invites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Link className="mb-3 h-10 w-10 text-discord-text-muted" />
          <p className="text-sm font-medium text-discord-text-normal">招待がありません</p>
          <p className="mt-1 text-xs text-discord-text-muted">
            このチャンネルにはアクティブな招待がありません
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1.2fr_1fr_90px_120px_40px] gap-2 px-2 text-xs font-bold uppercase text-discord-header-secondary">
            <span>招待コード</span>
            <span>作成者</span>
            <span>使用回数</span>
            <span>有効期限</span>
            <span />
          </div>
          {invites.map((invite) => {
            const isPending =
              revokeInvite.isPending &&
              pendingInviteCode !== null &&
              pendingInviteCode === invite.code;

            return (
              <div
                key={invite.code}
                className="grid grid-cols-[1.2fr_1fr_90px_120px_40px] items-center gap-2 rounded bg-discord-bg-secondary px-2 py-2"
              >
                <span className="truncate text-sm font-mono text-discord-text-normal">
                  {invite.code}
                </span>
                <span className="truncate text-sm text-discord-text-muted">
                  {invite.creator?.displayName ?? "不明"}
                </span>
                <span className="text-sm text-discord-text-muted">
                  {invite.uses}
                  {invite.maxUses !== null ? ` / ${invite.maxUses}` : ""}
                </span>
                <span className="text-sm text-discord-text-muted">
                  {formatDateTime(invite.expiresAt)}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  className="h-7 w-7 !p-0"
                  disabled={revokeInvite.isPending}
                  onClick={() => handleRevoke(invite.code)}
                  aria-label={isPending ? "招待を取り消し中" : "招待を取り消す"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
