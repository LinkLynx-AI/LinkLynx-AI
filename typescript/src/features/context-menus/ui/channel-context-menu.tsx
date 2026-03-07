"use client";

import { useActionGuard } from "@/shared/api/queries";
import { ContextMenu, MenuItem, MenuSeparator } from "@/shared/ui/context-menu";
import { useUIStore } from "@/shared/model/stores/ui-store";
import type { Channel } from "@/shared/model/types/channel";

export function ChannelContextMenu({ data }: { data: { channel: Channel; serverId: string } }) {
  const openModal = useUIStore((s) => s.openModal);
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const manageChannelGuard = useActionGuard({
    serverId: data.serverId,
    channelId: data.channel.id,
    requirement: "channel:manage",
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`/channels/${data.serverId}/${data.channel.id}`);
    hideContextMenu();
  };

  return (
    <ContextMenu>
      <MenuItem onClick={hideContextMenu}>既読にする</MenuItem>
      <MenuItem onClick={hideContextMenu}>チャンネルをミュート</MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!manageChannelGuard.isAllowed}
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
      <MenuItem disabled>招待を作成</MenuItem>
      <MenuItem
        danger
        disabled={!manageChannelGuard.isAllowed}
        onClick={() => {
          openModal("channel-delete", {
            channelId: data.channel.id,
            channelName: data.channel.name,
            serverId: data.serverId,
          });
          hideContextMenu();
        }}
      >
        チャンネルを削除
      </MenuItem>
    </ContextMenu>
  );
}
