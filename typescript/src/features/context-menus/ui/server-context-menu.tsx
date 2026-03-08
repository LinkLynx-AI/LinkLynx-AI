"use client";

import { useActionGuard } from "@/shared/api/queries";
import { ContextMenu, MenuItem, MenuSeparator } from "@/shared/ui/context-menu";
import { useUIStore } from "@/shared/model/stores/ui-store";
import type { Guild } from "@/shared/model/types/server";

export function ServerContextMenu({ data }: { data: { server: Guild } }) {
  const openModal = useUIStore((s) => s.openModal);
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const createChannelGuard = useActionGuard({
    serverId: data.server.id,
    requirement: "guild:create-channel",
  });
  const manageSettingsGuard = useActionGuard({
    serverId: data.server.id,
    requirement: "guild:manage-settings",
  });

  return (
    <ContextMenu>
      <MenuItem onClick={hideContextMenu}>既読にする</MenuItem>
      <MenuItem onClick={hideContextMenu}>サーバーをミュート</MenuItem>
      <MenuItem
        disabled={!createChannelGuard.isAllowed}
        onClick={() => {
          openModal("create-channel", { serverId: data.server.id });
          hideContextMenu();
        }}
      >
        チャンネルを作成
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled>招待を作成</MenuItem>
      <MenuItem
        disabled={!manageSettingsGuard.isAllowed}
        onClick={() => {
          openModal("server-settings", { serverId: data.server.id });
          hideContextMenu();
        }}
      >
        サーバー設定
      </MenuItem>
      <MenuSeparator />
      <MenuItem danger onClick={hideContextMenu}>
        サーバーから脱退
      </MenuItem>
    </ContextMenu>
  );
}
