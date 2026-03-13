"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Link as LinkIcon } from "lucide-react";
import { useCreateInvite } from "@/shared/api/mutations";
import { useChannels, useActionGuard } from "@/shared/api/queries";
import { toCreateActionErrorText } from "@/shared/api/guild-channel-api-client";
import type { Invite } from "@/shared/api/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { cn } from "@/shared/lib/cn";

const MAX_AGE_OPTIONS = [
  { value: "0", label: "期限なし", seconds: undefined },
  { value: "3600", label: "1時間", seconds: 3600 },
  { value: "21600", label: "6時間", seconds: 21_600 },
  { value: "86400", label: "24時間", seconds: 86_400 },
  { value: "604800", label: "7日間", seconds: 604_800 },
] as const;

const MAX_USE_OPTIONS = [
  { value: "0", label: "無制限", uses: undefined },
  { value: "1", label: "1回", uses: 1 },
  { value: "5", label: "5回", uses: 5 },
  { value: "10", label: "10回", uses: 10 },
  { value: "25", label: "25回", uses: 25 },
  { value: "100", label: "100回", uses: 100 },
] as const;

function formatExpiry(expiresAt: string | null): string {
  if (expiresAt === null) {
    return "期限なし";
  }

  return new Date(expiresAt).toLocaleString("ja-JP");
}

function formatMaxUses(maxUses: number): string {
  if (maxUses === 0) {
    return "無制限";
  }

  return `${maxUses} 回`;
}

function buildInviteUrl(invite: Invite): string {
  const path = `/invite/${invite.code}`;
  if (typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${path}`;
}

export function CreateInviteModal({
  onClose,
  serverId,
  channelId,
}: {
  onClose: () => void;
  serverId?: string;
  channelId?: string;
}) {
  const addToast = useUIStore((state) => state.addToast);
  const createInvite = useCreateInvite();
  const actionGuard = useActionGuard({
    serverId: serverId ?? "",
    requirement: "guild:create-invite",
    enabled: serverId !== undefined,
  });
  const channelsQuery = useChannels(serverId ?? "");
  const [selectedChannelId, setSelectedChannelId] = useState(channelId ?? "");
  const [selectedMaxAge, setSelectedMaxAge] = useState("86400");
  const [selectedMaxUses, setSelectedMaxUses] = useState("0");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteableChannels = useMemo(
    () => (channelsQuery.data ?? []).filter((candidate) => candidate.type === 0),
    [channelsQuery.data],
  );
  const inviteUrl = createdInvite === null ? "" : buildInviteUrl(createdInvite);

  useEffect(() => {
    if (channelId !== undefined && channelId.trim().length > 0) {
      setSelectedChannelId(channelId);
      return;
    }

    if (selectedChannelId.trim().length > 0) {
      return;
    }

    const firstChannel = inviteableChannels[0];
    if (firstChannel !== undefined) {
      setSelectedChannelId(firstChannel.id);
    }
  }, [channelId, inviteableChannels, selectedChannelId]);

  const handleClose = () => {
    if (createInvite.isPending) {
      return;
    }
    onClose();
  };

  const handleCreate = async () => {
    if (serverId === undefined) {
      setSubmitError("サーバーを選択してから作成してください。");
      return;
    }
    if (!actionGuard.isAllowed) {
      setSubmitError(actionGuard.message);
      return;
    }
    if (selectedChannelId.trim().length === 0) {
      setSubmitError("招待リンクを発行するチャンネルを選択してください。");
      return;
    }

    setSubmitError(null);
    setCopied(false);

    try {
      const invite = await createInvite.mutateAsync({
        serverId,
        channelId: selectedChannelId,
        data: {
          maxAge: MAX_AGE_OPTIONS.find((option) => option.value === selectedMaxAge)?.seconds,
          maxUses: MAX_USE_OPTIONS.find((option) => option.value === selectedMaxUses)?.uses,
        },
      });
      setCreatedInvite(invite);
    } catch (error: unknown) {
      setSubmitError(toCreateActionErrorText(error, "招待の作成に失敗しました。"));
    }
  };

  const handleCopy = async () => {
    if (createdInvite === null) {
      return;
    }

    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    addToast({ message: "招待リンクをコピーしました。", type: "success" });
  };

  const guardMessage = serverId === undefined ? null : actionGuard.message;
  const hasInviteableChannels = inviteableChannels.length > 0;

  return (
    <Modal open onClose={handleClose} className="max-w-[480px]">
      <ModalHeader>{createdInvite === null ? "招待を作成" : "招待リンクを共有"}</ModalHeader>
      <ModalBody>
        {createdInvite === null ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-discord-header-secondary">
                招待先のチャンネル
              </label>
              <select
                aria-label="招待先のチャンネル"
                value={selectedChannelId}
                onChange={(event) => {
                  setSelectedChannelId(event.target.value);
                  if (submitError !== null) {
                    setSubmitError(null);
                  }
                }}
                disabled={
                  !hasInviteableChannels || channelsQuery.isPending || channelId !== undefined
                }
                className={cn(
                  "h-10 w-full rounded-[3px] bg-discord-input-bg px-3 text-sm text-discord-text-normal outline-none transition-colors",
                  (!hasInviteableChannels || channelsQuery.isPending) &&
                    "cursor-not-allowed opacity-60",
                )}
              >
                {inviteableChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
              {channelId !== undefined && (
                <p className="text-xs text-discord-text-muted">
                  このチャンネル向けの招待として発行します。
                </p>
              )}
              {channelsQuery.isPending && (
                <p className="text-xs text-discord-text-muted">チャンネルを読み込んでいます。</p>
              )}
              {!channelsQuery.isPending && !hasInviteableChannels && (
                <p className="text-xs text-discord-brand-red">
                  招待を発行できるテキストチャンネルがありません。
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-discord-header-secondary">
                  有効期限
                </label>
                <select
                  aria-label="招待リンクの有効期限"
                  value={selectedMaxAge}
                  onChange={(event) => setSelectedMaxAge(event.target.value)}
                  className="h-10 w-full rounded-[3px] bg-discord-input-bg px-3 text-sm text-discord-text-normal outline-none transition-colors"
                >
                  {MAX_AGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-discord-header-secondary">
                  最大使用回数
                </label>
                <select
                  aria-label="招待リンクの最大使用回数"
                  value={selectedMaxUses}
                  onChange={(event) => setSelectedMaxUses(event.target.value)}
                  className="h-10 w-full rounded-[3px] bg-discord-input-bg px-3 text-sm text-discord-text-normal outline-none transition-colors"
                >
                  {MAX_USE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-[3px] bg-discord-bg-secondary px-3 py-3 text-sm text-discord-text-muted">
              この招待リンクはサーバー参加用です。参加後の表示チャンネルとして
              <span className="font-medium text-discord-text-normal">
                {" "}
                #
                {inviteableChannels.find((channel) => channel.id === selectedChannelId)?.name ??
                  "未選択"}
              </span>
              を案内します。
            </div>

            {guardMessage !== null && (
              <p
                className={cn(
                  "text-xs",
                  actionGuard.status === "loading"
                    ? "text-discord-text-muted"
                    : "text-discord-brand-red",
                )}
              >
                {guardMessage}
              </p>
            )}
            {submitError !== null && (
              <p className="text-xs text-discord-brand-red">{submitError}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[3px] bg-discord-bg-secondary px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-discord-text-normal">
                <LinkIcon className="h-4 w-4" />
                招待リンク
              </div>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly fullWidth />
                <Button type="button" variant="secondary" onClick={handleCopy}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copied ? "コピー済み" : "コピー"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-[3px] bg-discord-bg-secondary px-3 py-3 text-sm">
              <div>
                <div className="text-xs font-bold uppercase text-discord-header-secondary">
                  チャンネル
                </div>
                <div className="mt-1 text-discord-text-normal">#{createdInvite.channel.name}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-discord-header-secondary">
                  有効期限
                </div>
                <div className="mt-1 text-discord-text-normal">
                  {formatExpiry(createdInvite.expiresAt)}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-discord-header-secondary">
                  使用回数
                </div>
                <div className="mt-1 text-discord-text-normal">
                  {createdInvite.uses} / {formatMaxUses(createdInvite.maxUses)}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-discord-header-secondary">
                  サーバー
                </div>
                <div className="mt-1 text-discord-text-normal">{createdInvite.guild.name}</div>
              </div>
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        {createdInvite === null ? (
          <>
            <Button variant="link" onClick={handleClose}>
              キャンセル
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createInvite.isPending ||
                !actionGuard.isAllowed ||
                !hasInviteableChannels ||
                selectedChannelId.trim().length === 0
              }
            >
              {createInvite.isPending ? "作成中..." : "招待を作成"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="link"
              onClick={() => {
                setCreatedInvite(null);
                setCopied(false);
              }}
            >
              新しい招待を作成
            </Button>
            <Button onClick={handleClose}>閉じる</Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
