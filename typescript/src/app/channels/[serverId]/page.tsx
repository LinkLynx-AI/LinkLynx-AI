"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChannels } from "@/shared/api/queries/use-channels";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { buildChannelRoute } from "@/shared/config/routes";
import { ShellStatePlaceholder } from "@/widgets/app-shell";
import { findFirstTextChannel, resolveServerPageDisplayState } from "./page-state";

export default function ServerPage() {
  const router = useRouter();
  const params = useParams<{ serverId: string }>();
  const serverId = params.serverId;
  const { data: channels, isLoading, isError, error } = useChannels(serverId);

  useEffect(() => {
    if (!channels) {
      return;
    }

    const firstTextChannel = findFirstTextChannel(channels);
    if (firstTextChannel) {
      router.replace(buildChannelRoute(serverId, firstTextChannel.id));
    }
  }, [channels, serverId, router]);

  const displayState = resolveServerPageDisplayState({
    channels,
    isLoading,
    isError,
  });

  if (displayState === "loading") {
    return (
      <div className="p-6">
        <ShellStatePlaceholder
          state="loading"
          title="チャンネルを読み込み中です"
          description="サーバーのチャンネル情報を取得しています。"
        />
      </div>
    );
  }

  if (displayState === "error") {
    return (
      <div className="p-6">
        <ShellStatePlaceholder
          state="error"
          title="チャンネルの取得に失敗しました"
          description={toApiErrorText(error, "時間をおいて再試行してください。")}
        />
      </div>
    );
  }

  if (displayState === "redirect-or-idle") {
    return null;
  }

  return (
    <div className="p-6">
      <ShellStatePlaceholder
        state="empty"
        title="まだ表示できるチャンネルがありません"
        description="チャンネルが追加されるとここから遷移できます。"
      />
    </div>
  );
}
