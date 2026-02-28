import type { ChannelListItem, MemberListItem, ServerRailItem } from "@/entities";
import { cn } from "@/shared/lib";

type ChannelShellServerRailProps = {
  items: ReadonlyArray<ServerRailItem>;
};

type ChannelShellSidebarProps = {
  sectionLabel: string;
  items: ReadonlyArray<ChannelListItem>;
};

type ChannelShellMemberListProps = {
  items: ReadonlyArray<MemberListItem>;
};

export function ChannelShellServerRail({ items }: ChannelShellServerRailProps) {
  return (
    <div className="space-y-3 p-3">
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={cn(
            "flex h-12 w-12 items-center justify-center text-xs font-semibold transition",
            item.selected
              ? "rounded-2xl bg-[var(--llx-brand-blurple)] text-white"
              : "rounded-full bg-[var(--llx-bg-primary)] text-[var(--llx-text-secondary)] hover:bg-[var(--llx-bg-selected)]",
          )}
          aria-label={item.label}
          aria-current={item.selected ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

function formatChannelLabel(item: ChannelListItem): string {
  if (item.kind === "text") {
    return `# ${item.label}`;
  }

  return item.label;
}

export function ChannelShellSidebar({ sectionLabel, items }: ChannelShellSidebarProps) {
  return (
    <div className="p-3">
      <p className="px-2 py-2 text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        {sectionLabel}
      </p>
      <div className="mt-2 space-y-1">
        {items.map((item) => (
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
            {formatChannelLabel(item)}
          </a>
        ))}
      </div>
    </div>
  );
}

export function ChannelShellMemberList({ items }: ChannelShellMemberListProps) {
  return (
    <div className="space-y-2 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        Members
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded bg-[var(--llx-bg-primary)] px-2 py-2 text-sm text-[var(--llx-text-secondary)]"
        >
          {item.name}
        </div>
      ))}
    </div>
  );
}
