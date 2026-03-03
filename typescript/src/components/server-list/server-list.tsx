"use client";

import { useServers } from "@/services/queries/use-servers";
import { useGuildStore } from "@/stores/guild-store";
import { HomeButton } from "./home-button";
import { ServerIcon } from "./server-icon";
import { ServerListSeparator } from "./server-list-separator";
import { AddServerButton } from "./add-server-button";
import { DiscoverButton } from "./discover-button";

export function ServerList() {
  const { data: servers } = useServers();
  const activeServerId = useGuildStore((s) => s.activeServerId);

  return (
    <nav
      className="flex h-full w-[72px] flex-col items-center gap-2 bg-discord-bg-tertiary py-3 overflow-y-auto discord-scrollbar"
      aria-label="サーバー"
    >
      <HomeButton />
      <ServerListSeparator />

      {servers?.map((server) => (
        <ServerIcon key={server.id} server={server} isActive={activeServerId === server.id} />
      ))}

      <ServerListSeparator />
      <AddServerButton />
      <DiscoverButton />
    </nav>
  );
}
