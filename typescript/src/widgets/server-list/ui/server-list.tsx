"use client";

import { useServers } from "@/shared/api/queries/use-servers";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { parseGuildChannelRoute } from "@/shared/config/routes";
import { useGuildStore } from "@/shared/model/stores/guild-store";
import { usePathname } from "next/navigation";
import { HomeButton } from "./home-button";
import { ServerIcon } from "./server-icon";
import { ServerListSeparator } from "./server-list-separator";
import { AddServerButton } from "./add-server-button";
import { DiscoverButton } from "./discover-button";

export function ServerList() {
  const pathname = usePathname();
  const { data: servers, isLoading, isError, error } = useServers();
  const activeServerIdFromStore = useGuildStore((s) => s.activeServerId);
  const routeSelection = parseGuildChannelRoute(pathname ?? "");
  const activeServerId = routeSelection?.guildId ?? activeServerIdFromStore;
  const serverErrorMessage = toApiErrorText(error, "サーバー一覧の取得に失敗しました。");
  const hasServers = (servers?.length ?? 0) > 0;
  const shouldShowError = isError && !hasServers;

  return (
    <nav
      className="flex h-full w-[72px] flex-col items-center gap-2 bg-discord-bg-tertiary py-3 overflow-y-auto discord-scrollbar"
      aria-label="サーバー"
    >
      <HomeButton />
      <ServerListSeparator />

      {isLoading && (
        <div className="flex flex-col items-center gap-2">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-12 w-12 animate-pulse rounded-full bg-discord-bg-primary"
            />
          ))}
        </div>
      )}

      {shouldShowError && (
        <p className="px-2 text-center text-[10px] leading-4 text-discord-text-muted">
          {serverErrorMessage}
        </p>
      )}

      {!isLoading &&
        hasServers &&
        servers?.map((server) => (
          <ServerIcon key={server.id} server={server} isActive={activeServerId === server.id} />
        ))}

      {!isLoading && !hasServers && !shouldShowError && (
        <p className="px-2 text-center text-[10px] leading-4 text-discord-text-muted">
          参加中のサーバーはありません。
        </p>
      )}

      <ServerListSeparator />
      <AddServerButton />
      <DiscoverButton />
    </nav>
  );
}
