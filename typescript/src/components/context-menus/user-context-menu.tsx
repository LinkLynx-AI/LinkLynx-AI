"use client";

import { ContextMenu, MenuItem, MenuSeparator } from "@/components/ui/context-menu";
import { useUIStore } from "@/stores/ui-store";
import type { User } from "@/types/user";

export function UserContextMenu({ data }: { data: { user: User; serverId?: string } }) {
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const showProfilePopout = useUIStore((s) => s.showProfilePopout);

  const handleProfile = () => {
    const contextMenu = useUIStore.getState().contextMenu;
    if (contextMenu) {
      showProfilePopout(data.user.id, contextMenu.position);
    }
    hideContextMenu();
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(data.user.id);
    hideContextMenu();
  };

  return (
    <ContextMenu>
      <MenuItem onClick={handleProfile}>プロフィール</MenuItem>
      <MenuItem onClick={hideContextMenu}>メッセージ</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={handleCopyId}>ユーザーIDをコピー</MenuItem>
    </ContextMenu>
  );
}
