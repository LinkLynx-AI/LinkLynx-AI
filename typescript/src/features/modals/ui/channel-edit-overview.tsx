"use client";

import { useEffect, useState } from "react";
import { toUpdateActionErrorText } from "@/shared/api/guild-channel-api-client";
import { useActionGuard } from "@/shared/api/queries";
import { useUpdateChannel } from "@/shared/api/mutations/use-channel-update";
import { useChannel } from "@/shared/api/queries/use-channels";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ChannelDeleteModal } from "./channel-delete-modal";

const CHANNEL_NAME_MAX_CHARS = 100;

export function ChannelEditOverview({
  channelId,
  onSaved,
}: {
  channelId?: string;
  onSaved?: () => void;
}) {
  const { data: channel, isLoading } = useChannel(channelId ?? "");
  const updateChannel = useUpdateChannel();
  const manageChannelGuard = useActionGuard({
    serverId: channel?.guildId ?? "",
    channelId,
    requirement: "channel:manage",
    enabled: channelId !== undefined && channel?.guildId !== undefined,
  });
  const [name, setName] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (channel !== undefined) {
      setName(channel.name);
      setSubmitError(null);
    }
  }, [channel?.name]);

  const handleSave = async () => {
    if (channelId === undefined) {
      setSubmitError("チャンネルIDを確認してから再試行してください。");
      return;
    }
    if (!manageChannelGuard.isAllowed) {
      setSubmitError(manageChannelGuard.message);
      return;
    }

    const normalizedName = name.trim();
    if (normalizedName.length === 0) {
      setSubmitError("入力内容を確認してください。");
      return;
    }
    if (normalizedName.length > CHANNEL_NAME_MAX_CHARS) {
      setSubmitError("チャンネル名は100文字以内で入力してください。");
      return;
    }

    setSubmitError(null);
    try {
      await updateChannel.mutateAsync({
        channelId,
        data: { name: normalizedName },
      });
      onSaved?.();
    } catch (error: unknown) {
      setSubmitError(toUpdateActionErrorText(error, "チャンネルの更新に失敗しました。"));
    }
  };

  const normalizedName = name.trim();
  const overMaxNameLength = normalizedName.length > CHANNEL_NAME_MAX_CHARS;
  const inputError =
    submitError ?? (overMaxNameLength ? "チャンネル名は100文字以内で入力してください。" : null);
  const canSave =
    channelId !== undefined &&
    channel !== undefined &&
    normalizedName.length > 0 &&
    !overMaxNameLength &&
    normalizedName !== channel.name &&
    manageChannelGuard.isAllowed &&
    !updateChannel.isPending;
  const guardMessage = channel?.guildId === undefined ? null : manageChannelGuard.message;

  return (
    <div className="space-y-6">
      {isLoading && (
        <p className="text-sm text-discord-text-muted">チャンネル情報を読み込み中...</p>
      )}
      <Input
        label="チャンネル名"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (submitError !== null) {
            setSubmitError(null);
          }
        }}
        error={inputError ?? undefined}
        fullWidth
      />
      {guardMessage !== null && (
        <p
          className={`text-xs ${
            manageChannelGuard.status === "loading"
              ? "text-discord-text-muted"
              : "text-discord-brand-red"
          }`}
        >
          {guardMessage}
        </p>
      )}
      <div className="flex justify-end">
        <Button disabled={!canSave} onClick={() => void handleSave()}>
          {updateChannel.isPending ? "保存中..." : "変更を保存"}
        </Button>
      </div>
      <section className="rounded-md border border-discord-btn-danger/30 bg-discord-btn-danger/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-discord-text-normal">チャンネルを削除</h3>
            <p className="mt-1 text-xs text-discord-text-muted">
              削除すると一覧から消え、元に戻せません。
            </p>
          </div>
          <Button
            variant="danger"
            disabled={
              channelId === undefined ||
              channel?.guildId === undefined ||
              !manageChannelGuard.isAllowed
            }
            onClick={() => setDeleteModalOpen(true)}
          >
            チャンネルを削除
          </Button>
        </div>
      </section>
      {deleteModalOpen && (
        <ChannelDeleteModal
          channelId={channelId}
          channelName={channel?.name ?? name}
          onClose={() => setDeleteModalOpen(false)}
          onDeleted={onSaved}
          serverId={channel?.guildId}
        />
      )}
    </div>
  );
}
