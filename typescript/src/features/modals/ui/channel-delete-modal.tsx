"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { findFirstTextChannel } from "@/features/channel-navigation";
import { toDeleteActionErrorText } from "@/shared/api/guild-channel-api-client";
import { useDeleteChannel } from "@/shared/api/mutations/use-channel-actions";
import { useActionGuard } from "@/shared/api/queries";
import { useChannels } from "@/shared/api/queries/use-channels";
import { buildChannelRoute, buildGuildRoute, parseGuildChannelRoute } from "@/shared/config/routes";
import type { Channel } from "@/shared/model/types";
import { Button } from "@/shared/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";

function collectDeletedChannelIds(channels: Channel[], channelId: string): Set<string> {
  const deletedIds = new Set<string>([channelId]);

  let foundChild = true;
  while (foundChild) {
    foundChild = false;
    for (const channel of channels) {
      if (
        channel.parentId !== null &&
        deletedIds.has(channel.parentId) &&
        !deletedIds.has(channel.id)
      ) {
        deletedIds.add(channel.id);
        foundChild = true;
      }
    }
  }

  return deletedIds;
}

export function ChannelDeleteModal({
  onClose,
  onDeleted,
  channelId,
  channelName,
  channelType,
  serverId,
}: {
  onClose: () => void;
  onDeleted?: () => void;
  channelId?: string;
  channelName?: string;
  channelType?: number;
  serverId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const deleteChannel = useDeleteChannel();
  const { data: channels } = useChannels(serverId ?? "");
  const manageChannelGuard = useActionGuard({
    serverId: serverId ?? "",
    channelId,
    requirement: "channel:manage",
    enabled: serverId !== undefined && channelId !== undefined,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const guardMessage =
    serverId === undefined || channelId === undefined ? null : manageChannelGuard.message;

  const routeSelection = parseGuildChannelRoute(pathname ?? "");
  const deletedIds =
    channelId === undefined
      ? new Set<string>()
      : collectDeletedChannelIds(channels ?? [], channelId);
  const isDeletingSelectedChannel =
    routeSelection !== null &&
    routeSelection.guildId === serverId &&
    routeSelection.channelId !== null &&
    deletedIds.has(routeSelection.channelId);
  const isCategory = channelType === 4;

  const handleDelete = async () => {
    if (serverId === undefined || channelId === undefined) {
      setSubmitError("チャンネル情報を確認してから再試行してください。");
      return;
    }
    if (!manageChannelGuard.isAllowed) {
      setSubmitError(manageChannelGuard.message);
      return;
    }

    setSubmitError(null);
    try {
      await deleteChannel.mutateAsync({ serverId, channelId });
      if (isDeletingSelectedChannel) {
        const cachedChannels =
          queryClient.getQueryData<Channel[]>(["channels", serverId]) ??
          channels?.filter((channel) => !deletedIds.has(channel.id)) ??
          [];
        const nextChannel = findFirstTextChannel(cachedChannels);
        const fallbackRoute =
          nextChannel === null
            ? buildGuildRoute(serverId)
            : buildChannelRoute(serverId, nextChannel.id);

        router.replace(fallbackRoute);
      }
      onDeleted?.();
      onClose();
    } catch (error: unknown) {
      setSubmitError(toDeleteActionErrorText(error, "チャンネルの削除に失敗しました。"));
    }
  };

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>{isCategory ? "カテゴリーを削除" : "チャンネルを削除"}</ModalHeader>
      <ModalBody>
        <p className="text-sm text-discord-text-normal">
          {isCategory
            ? channelName
              ? `${channelName} カテゴリを削除します。`
              : "このカテゴリを削除します。"
            : channelName
              ? `#${channelName} を削除します。`
              : "このチャンネルを削除します。"}
        </p>
        <p className="mt-2 text-sm text-discord-text-muted">
          {isCategory
            ? "この操作は取り消せません。削除すると配下のチャンネルも一覧から除外されます。"
            : "この操作は取り消せません。削除するとチャンネル一覧から除外されます。"}
        </p>
        {submitError === null && guardMessage !== null && (
          <p
            className={`mt-3 text-sm ${
              manageChannelGuard.status === "loading"
                ? "text-discord-text-muted"
                : "text-discord-btn-danger"
            }`}
          >
            {guardMessage}
          </p>
        )}
        {submitError !== null && (
          <p className="mt-3 text-sm text-discord-btn-danger">{submitError}</p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="link" onClick={onClose}>
          キャンセル
        </Button>
        <Button
          variant="danger"
          disabled={
            deleteChannel.isPending ||
            channelId === undefined ||
            serverId === undefined ||
            !manageChannelGuard.isAllowed
          }
          onClick={() => void handleDelete()}
        >
          {deleteChannel.isPending
            ? "削除中..."
            : isCategory
              ? "カテゴリーを削除"
              : "チャンネルを削除"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
