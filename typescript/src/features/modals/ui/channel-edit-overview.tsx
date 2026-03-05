"use client";

import { useEffect, useState } from "react";
import { toUpdateActionErrorText } from "@/shared/api/guild-channel-api-client";
import { useUpdateChannel } from "@/shared/api/mutations/use-channel-update";
import { useChannel } from "@/shared/api/queries/use-channels";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export function ChannelEditOverview({
  channelId,
  onSaved,
}: {
  channelId?: string;
  onSaved?: () => void;
}) {
  const { data: channel, isLoading } = useChannel(channelId ?? "");
  const updateChannel = useUpdateChannel();
  const [name, setName] = useState("");
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

    const normalizedName = name.trim();
    if (normalizedName.length === 0) {
      setSubmitError("入力内容を確認してください。");
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
  const canSave =
    channelId !== undefined &&
    channel !== undefined &&
    normalizedName.length > 0 &&
    normalizedName !== channel.name &&
    !updateChannel.isPending;

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
        error={submitError ?? undefined}
        fullWidth
      />
      <div className="flex justify-end">
        <Button disabled={!canSave} onClick={() => void handleSave()}>
          {updateChannel.isPending ? "保存中..." : "変更を保存"}
        </Button>
      </div>
    </div>
  );
}
