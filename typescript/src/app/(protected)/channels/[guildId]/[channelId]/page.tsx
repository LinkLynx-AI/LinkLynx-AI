import { ProtectedPreviewGate } from "@/features";
import { APP_ROUTES } from "@/shared/config";
import { ChannelShellLayout, ShellStatePlaceholder } from "@/widgets";
import {
  ChannelShellMemberList,
  ChannelShellServerRail,
  ChannelShellSidebar,
} from "@/app/(protected)/_components/channel-shell-preview";
import { resolveProtectedPreviewState } from "@/app/(protected)/_lib/preview";

type SearchParamsObject = Record<string, string | string[] | undefined>;

type ChannelRouteParams =
  | Promise<{ guildId: string; channelId: string }>
  | { guildId: string; channelId: string };

type ChannelPageProps = {
  params: ChannelRouteParams;
  searchParams?: Promise<SearchParamsObject> | SearchParamsObject;
};

export default async function ChannelPage({ params, searchParams }: ChannelPageProps) {
  const previewState = await resolveProtectedPreviewState(searchParams);
  const resolvedParams = await Promise.resolve(params);

  const mainContent =
    previewState.state === null ? (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--llx-text-primary)]">
          #{resolvedParams.channelId} ({resolvedParams.guildId})
        </h1>
        <p className="text-sm text-[var(--llx-text-muted)]">
          チャンネル詳細ルートのプレビューです。状態切替は `state` / `guard` クエリで確認できます。
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`${APP_ROUTES.channels.me}?state=empty`}
            className="rounded-md border border-[var(--llx-divider)] px-3 py-2 text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            empty
          </a>
          <a
            href={`${APP_ROUTES.channels.me}?guard=not-found`}
            className="rounded-md border border-[var(--llx-divider)] px-3 py-2 text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            not-found
          </a>
        </div>
      </section>
    ) : (
      <ShellStatePlaceholder state={previewState.state} />
    );

  return (
    <ProtectedPreviewGate guard={previewState.guard}>
      <ChannelShellLayout
        serverRail={<ChannelShellServerRail />}
        channelSidebar={<ChannelShellSidebar />}
        memberList={<ChannelShellMemberList />}
        mainContent={mainContent}
      />
    </ProtectedPreviewGate>
  );
}
