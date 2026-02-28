import { ProtectedPreviewGate } from "@/features";
import { APP_ROUTES } from "@/shared/config";
import { SettingsShellLayout, ShellStatePlaceholder } from "@/widgets";
import {
  SettingsShellCloseRail,
  SettingsShellSidebar,
} from "@/app/(protected)/_components/settings-shell-preview";
import { resolveProtectedPreviewState } from "@/app/(protected)/_lib/preview";

type SearchParamsObject = Record<string, string | string[] | undefined>;

type ProfileSettingsPageProps = {
  searchParams?: Promise<SearchParamsObject> | SearchParamsObject;
};

export default async function ProfileSettingsPage({ searchParams }: ProfileSettingsPageProps) {
  const previewState = await resolveProtectedPreviewState(searchParams);

  const content =
    previewState.state === null ? (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--llx-text-primary)]">プロフィール設定</h1>
        <p className="text-sm text-[var(--llx-text-muted)]">
          設定App Shellのプレビューです。`state` クエリで共通プレースホルダを確認できます。
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`${APP_ROUTES.settings.profile}?state=readonly`}
            className="rounded-md border border-[var(--llx-divider)] px-3 py-2 text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            readonly
          </a>
          <a
            href={`${APP_ROUTES.settings.profile}?guard=forbidden`}
            className="rounded-md border border-[var(--llx-divider)] px-3 py-2 text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
          >
            forbidden
          </a>
        </div>
      </section>
    ) : (
      <ShellStatePlaceholder state={previewState.state} />
    );

  return (
    <ProtectedPreviewGate guard={previewState.guard}>
      <SettingsShellLayout
        sidebar={<SettingsShellSidebar />}
        closeRail={<SettingsShellCloseRail />}
        content={content}
      />
    </ProtectedPreviewGate>
  );
}
