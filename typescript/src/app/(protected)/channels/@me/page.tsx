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

type ChannelsMePageProps = {
  searchParams?: Promise<SearchParamsObject> | SearchParamsObject;
};

export default async function ChannelsMePage({ searchParams }: ChannelsMePageProps) {
  const previewState = await resolveProtectedPreviewState(searchParams);

  const mainContent =
    previewState.state === null ? (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--llx-text-primary)]">
          @me ダッシュボード
        </h1>
        <p className="text-sm text-[var(--llx-text-muted)]">
          保護ルートの表示プレビューです。`?state=loading|empty|error|readonly|disabled` または
          `?guard=unauthenticated|forbidden|not-found` を付与して状態を確認できます。
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`${APP_ROUTES.channels.me}?state=loading`}
            className="rounded-md border border-[var(--llx-divider)] px-3 py-2 text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            loading
          </a>
          <a
            href={`${APP_ROUTES.channels.me}?guard=unauthenticated`}
            className="rounded-md border border-[var(--llx-divider)] px-3 py-2 text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            unauthenticated
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
