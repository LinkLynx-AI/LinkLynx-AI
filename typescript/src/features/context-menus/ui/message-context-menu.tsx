"use client";

import { toDeleteActionErrorText } from "@/shared/api";
import { useDeleteMessage } from "@/shared/api/mutations";
import { ContextMenu, MenuItem, MenuSeparator } from "@/shared/ui/context-menu";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { Message } from "@/shared/model/types/message";

export function MessageContextMenu({ data }: { data: { message: Message } }) {
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const addToast = useUIStore((s) => s.addToast);
  const startMessageEdit = useUIStore((s) => s.startMessageEdit);
  const currentPrincipalId = useAuthStore((s) => s.currentPrincipalId);
  const currentUser = useAuthStore((s) => s.currentUser);
  const deleteMessage = useDeleteMessage();

  const isOwnMessage = (currentPrincipalId ?? currentUser?.id ?? null) === data.message.author.id;
  const canMutateMessage = isOwnMessage && !data.message.isDeleted;

  const handleCopyText = () => {
    navigator.clipboard.writeText(data.message.content);
    hideContextMenu();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`/channels/${data.message.channelId}/${data.message.id}`);
    hideContextMenu();
  };

  const handleEdit = () => {
    startMessageEdit(data.message.channelId, data.message.id);
    hideContextMenu();
  };

  const handleDelete = () => {
    hideContextMenu();
    deleteMessage.mutate(
      {
        channelId: data.message.channelId,
        messageId: data.message.id,
        message: data.message,
      },
      {
        onError: (error) => {
          addToast({
            message: toDeleteActionErrorText(error, "メッセージの削除に失敗しました。"),
            type: "error",
          });
        },
      },
    );
  };

  return (
    <ContextMenu>
      <MenuItem onClick={hideContextMenu}>返信</MenuItem>
      <MenuItem onClick={hideContextMenu}>スレッドを作成</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={handleCopyText}>テキストをコピー</MenuItem>
      <MenuItem onClick={handleCopyLink}>メッセージリンクをコピー</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={hideContextMenu}>
        {data.message.pinned ? "ピン留め解除" : "ピン留め"}
      </MenuItem>
      <MenuSeparator />
      {canMutateMessage ? (
        <>
          <MenuItem onClick={handleEdit}>メッセージを編集</MenuItem>
          <MenuItem danger onClick={handleDelete}>
            メッセージを削除
          </MenuItem>
        </>
      ) : isOwnMessage ? null : (
        <MenuItem danger onClick={hideContextMenu}>
          メッセージを報告
        </MenuItem>
      )}
    </ContextMenu>
  );
}
