"use client";

import { ContextMenu, MenuItem, MenuSeparator } from "@/shared/ui/legacy/context-menu";
import { useUIStore } from "@/shared/model/legacy/stores/ui-store";
import type { Guild } from "@/shared/model/legacy/types/server";

export function ServerContextMenu({ data }: { data: { server: Guild } }) {
  const openModal = useUIStore((s) => s.openModal);
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);

  return (
    <ContextMenu>
      <MenuItem onClick={hideContextMenu}>既読にする</MenuItem>
      <MenuItem onClick={hideContextMenu}>サーバーをミュート</MenuItem>
      <MenuItem
        onClick={() => {
          openModal("create-invite");
          hideContextMenu();
        }}
      >
        招待を作成
      </MenuItem>
      <MenuItem
        onClick={() => {
          openModal("server-settings");
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
