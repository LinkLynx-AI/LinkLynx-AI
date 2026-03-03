"use client";

import { useEffect, useCallback, useRef } from "react";
import { useUIStore } from "@/shared/model/stores/ui-store";
import { ServerContextMenu } from "./server-context-menu";
import { ChannelContextMenu } from "./channel-context-menu";
import { MessageContextMenu } from "./message-context-menu";
import { UserContextMenu } from "./user-context-menu";

function getMenuComponent(type: string, data: unknown) {
  switch (type) {
    case "server":
      return (
        <ServerContextMenu data={data as { server: import("@/shared/model/types/server").Guild }} />
      );
    case "channel":
      return (
        <ChannelContextMenu
          data={
            data as { channel: import("@/shared/model/types/channel").Channel; serverId: string }
          }
        />
      );
    case "message":
      return (
        <MessageContextMenu
          data={data as { message: import("@/shared/model/types/message").Message }}
        />
      );
    case "user":
      return (
        <UserContextMenu
          data={data as { user: import("@/shared/model/types/user").User; serverId?: string }}
        />
      );
    default:
      return null;
  }
}

function clampPosition(x: number, y: number, menuWidth: number, menuHeight: number) {
  const clampedX = x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 8 : x;
  const clampedY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 8 : y;
  return {
    x: Math.max(8, clampedX),
    y: Math.max(8, clampedY),
  };
}

export function ContextMenuPortal() {
  const contextMenu = useUIStore((s) => s.contextMenu);
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hideContextMenu();
      }
    },
    [hideContextMenu],
  );

  useEffect(() => {
    if (!contextMenu) return;

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", hideContextMenu, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", hideContextMenu, true);
    };
  }, [contextMenu, handleKeyDown, hideContextMenu]);

  useEffect(() => {
    if (!contextMenu || !menuRef.current) return;

    const menu = menuRef.current;
    const { x, y } = clampPosition(
      contextMenu.position.x,
      contextMenu.position.y,
      menu.offsetWidth,
      menu.offsetHeight,
    );
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }, [contextMenu]);

  if (!contextMenu) return null;

  const menuContent = getMenuComponent(contextMenu.type, contextMenu.data);
  if (!menuContent) return null;

  return (
    <div
      className="fixed inset-0 z-[1000]"
      onClick={hideContextMenu}
      onContextMenu={(e) => {
        e.preventDefault();
        hideContextMenu();
      }}
    >
      <div
        ref={menuRef}
        className="fixed z-[1001]"
        style={{
          left: contextMenu.position.x,
          top: contextMenu.position.y,
        }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {menuContent}
      </div>
    </div>
  );
}
