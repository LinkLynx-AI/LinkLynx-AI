"use client";

import {
  ContextMenu,
  MenuItem,
  MenuSeparator,
} from "@/components/ui/context-menu";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import type { Message } from "@/types/message";

export function MessageContextMenu({
  data,
}: {
  data: { message: Message };
}) {
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const currentUser = useAuthStore((s) => s.currentUser);

  const isOwnMessage = currentUser?.id === data.message.author.id;

  const handleCopyText = () => {
    navigator.clipboard.writeText(data.message.content);
    hideContextMenu();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(
      `/channels/${data.message.channelId}/${data.message.id}`
    );
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
