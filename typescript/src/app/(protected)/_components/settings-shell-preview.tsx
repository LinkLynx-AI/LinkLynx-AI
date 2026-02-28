import type { SettingsShellNavigation } from "@/entities";
import { cn } from "@/shared/lib";

type SettingsShellSidebarProps = {
  navigation: SettingsShellNavigation;
};

type SettingsShellCloseRailProps = {
  closeLink: SettingsShellNavigation["closeLink"];
  closeHint: SettingsShellNavigation["closeHint"];
};

export function SettingsShellSidebar({ navigation }: SettingsShellSidebarProps) {
  return (
    <div className="space-y-1 p-3">
      <p className="px-2 py-2 text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        {navigation.sectionLabel}
      </p>
      {navigation.items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={cn(
            "block rounded px-2 py-2 text-sm transition",
            item.selected
              ? "bg-[var(--llx-bg-selected)] text-[var(--llx-text-primary)]"
              : "text-[var(--llx-text-secondary)] hover:bg-[var(--llx-bg-selected)]",
          )}
          aria-current={item.selected ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

export function SettingsShellCloseRail({ closeLink, closeHint }: SettingsShellCloseRailProps) {
  return (
    <div className="flex flex-col items-center gap-2 text-[var(--llx-text-muted)]">
      <a
        href={closeLink.href}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] text-sm transition hover:bg-[var(--llx-bg-selected)]"
        aria-label={closeLink.label}
      >
        ✕
      </a>
      <span className="text-xs">{closeHint}</span>
    </div>
  );
}
