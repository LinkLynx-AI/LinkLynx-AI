"use client";

import {
  ContextMenu,
  MenuItem,
  MenuSeparator,
} from "@/components/ui/context-menu";
import { useUIStore } from "@/stores/ui-store";
import type { Channel } from "@/types/channel";

export function ChannelContextMenu({
  data,
}: {
  data: { channel: Channel; serverId: string };
}) {
  const openModal = useUIStore((s) => s.openModal);
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(
      `/channels/${data.serverId}/${data.channel.id}`
    );
    hideContextMenu();
  };

  return (
    <ContextMenu>
      <MenuItem onClick={hideContextMenu}>既読にする</MenuItem>
      <MenuItem onClick={hideContextMenu}>チャンネルをミュート</MenuItem>
      <MenuSeparator />
      <MenuItem
        onClick={() => {
          openModal("channel-edit", {
            channelId: data.channel.id,
            channelName: data.channel.name,
          });
          hideContextMenu();
        }}
      >
        チャンネルを編集
      </MenuItem>
      <MenuItem onClick={handleCopyLink}>チャンネルリンクをコピー</MenuItem>
      {useUIStore.getState().developerMode && (
        <MenuItem
          onClick={() => {
            navigator.clipboard.writeText(data.channel.id);
            hideContextMenu();
          }}
        >
          IDをコピー
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem
        onClick={() => {
          openModal("create-invite");
          hideContextMenu();
        }}
      >
        招待を作成
      </MenuItem>
      <MenuItem
        danger
        onClick={() => {
          openModal("delete-confirm");
          hideContextMenu();
        }}
      >
        チャンネルを削除
      </MenuItem>
    </ContextMenu>
  );
}
