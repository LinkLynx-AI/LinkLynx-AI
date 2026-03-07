"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { toDeleteActionErrorText } from "@/shared/api/guild-channel-api-client";
import { useDeleteServer } from "@/shared/api/mutations/use-server-actions";
import { buildGuildRoute, parseGuildChannelRoute } from "@/shared/config/routes";
import type { Guild } from "@/shared/model/types";
import { Button } from "@/shared/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";

export function ServerDeleteModal({
  onClose,
  onDeleted,
  serverId,
  serverName,
}: {
  onClose: () => void;
  onDeleted?: () => void;
  serverId?: string;
  serverName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const deleteServer = useDeleteServer();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const routeSelection = parseGuildChannelRoute(pathname ?? "");
  const isDeletingSelectedServer = routeSelection?.guildId === serverId;

  const handleDelete = async () => {
    if (serverId === undefined) {
      setSubmitError("サーバー情報を確認してから再試行してください。");
      return;
    }

    setSubmitError(null);
    try {
      await deleteServer.mutateAsync(serverId);

      if (isDeletingSelectedServer) {
        const remainingServers = queryClient.getQueryData<Guild[]>(["servers"]) ?? [];
        const nextServer = remainingServers[0];
        router.replace(nextServer === undefined ? "/channels/me" : buildGuildRoute(nextServer.id));
      }

      onClose();
      onDeleted?.();
    } catch (error: unknown) {
      setSubmitError(toDeleteActionErrorText(error, "サーバーの削除に失敗しました。"));
    }
  };

  return (
    <Modal open onClose={onClose} className="max-w-[440px]">
      <ModalHeader>サーバーを削除</ModalHeader>
      <ModalBody>
        <p className="text-sm text-discord-text-normal">
          {serverName ? `「${serverName}」を削除します。` : "このサーバーを削除します。"}
        </p>
        <p className="mt-2 text-sm text-discord-text-muted">
          この操作は取り消せません。削除するとメンバー、チャンネル、招待もサーバー一覧から除外されます。
        </p>
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
          disabled={deleteServer.isPending || serverId === undefined}
          onClick={() => void handleDelete()}
        >
          {deleteServer.isPending ? "削除中..." : "サーバーを削除"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
