"use client";

import { ContextMenu, MenuItem, MenuSeparator } from "@/shared/ui/context-menu";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import type { Message } from "@/shared/model/types/message";

export function MessageContextMenu({ data }: { data: { message: Message } }) {
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const currentPrincipalId = useAuthStore((s) => s.currentPrincipalId);
  const currentUser = useAuthStore((s) => s.currentUser);

  const isOwnMessage = (currentPrincipalId ?? currentUser?.id ?? null) === data.message.author.id;

  const handleCopyText = () => {
    navigator.clipboard.writeText(data.message.content);
    hideContextMenu();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`/channels/${data.message.channelId}/${data.message.id}`);
    hideContextMenu();
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
      {isOwnMessage ? (
        <>
          <MenuItem onClick={hideContextMenu}>メッセージを編集</MenuItem>
          <MenuItem danger onClick={hideContextMenu}>
            メッセージを削除
          </MenuItem>
        </>
      ) : (
        <MenuItem danger onClick={hideContextMenu}>
          メッセージを報告
        </MenuItem>
      )}
    </ContextMenu>
  );
}
