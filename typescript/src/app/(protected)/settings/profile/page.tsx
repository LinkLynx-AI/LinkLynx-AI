import { ProtectedPreviewGate } from "@/features";
import { createUiGateway } from "@/entities";
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
  const uiGateway = createUiGateway();
  const [previewState, navigation, content] = await Promise.all([
    resolveProtectedPreviewState(searchParams),
    uiGateway.guild.getSettingsShellNavigation(),
    uiGateway.message.getProfileSettingsContent(),
  ]);
  const profileNavigation = {
    ...navigation,
    items: navigation.items.map((item) => ({
      ...item,
      selected: item.id === "profile",
    })),
  };

  const mainContent =
    previewState.state === null ? (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--llx-text-primary)]">{content.title}</h1>
        <p className="text-sm text-[var(--llx-text-muted)]">{content.description}</p>
        <div className="flex flex-wrap gap-3">
          {content.quickActions.map((action) => (
            <a
              key={`${action.href}-${action.label}`}
              href={action.href}
              className="rounded-md border border-[var(--llx-divider)] px-3 py-2 text-xs text-[var(--llx-text-secondary)] transition hover:bg-[var(--llx-bg-selected)]"
            >
              {action.label}
            </a>
          ))}
        </div>
      </section>
    ) : (
      <ShellStatePlaceholder state={previewState.state} />
    );

  return (
    <ProtectedPreviewGate guard={previewState.guard}>
      <SettingsShellLayout
        sidebar={<SettingsShellSidebar navigation={profileNavigation} />}
        closeRail={
          <SettingsShellCloseRail
            closeLink={profileNavigation.closeLink}
            closeHint={profileNavigation.closeHint}
          />
        }
        content={mainContent}
      />
    </ProtectedPreviewGate>
  );
}
