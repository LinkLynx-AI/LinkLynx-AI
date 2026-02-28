import type { ChannelListItem, MemberListItem, ServerRailItem } from "@/entities";
import { cn } from "@/shared/lib";

type ChannelServerRailProps = {
  items: ReadonlyArray<ServerRailItem>;
};

type ChannelSidebarProps = {
  sectionLabel: string;
  items: ReadonlyArray<ChannelListItem>;
};

type ChannelMemberListProps = {
  items: ReadonlyArray<MemberListItem>;
};

const SECTION_LABEL_MAP = {
  shortcuts: "ショートカット",
  dm: "ダイレクトメッセージ",
  channels: "チャンネル",
} as const;

const KIND_ICON_MAP = {
  dm: "@",
  text: "#",
  settings: "⚙",
} as const;

const PRESENCE_CLASS_MAP = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  dnd: "bg-red-500",
  offline: "bg-[var(--llx-interactive-muted)]",
} as const;

/**
 * Server rail UIを描画する。
 */
export function ChannelServerRail({ items }: ChannelServerRailProps) {
  return (
    <div className="space-y-3 p-3">
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={cn(
            "relative flex h-12 w-12 items-center justify-center text-xs font-semibold transition",
            item.selected
              ? "rounded-2xl bg-[var(--llx-brand-blurple)] text-white"
              : "rounded-full bg-[var(--llx-bg-primary)] text-[var(--llx-text-secondary)] hover:bg-[var(--llx-bg-selected)]",
            item.muted && !item.selected && "text-[var(--llx-interactive-muted)]",
          )}
          aria-label={item.label}
          aria-current={item.selected ? "page" : undefined}
        >
          {item.label}
          {(item.unreadCount ?? 0) > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--llx-brand-red)] px-1 text-[10px] font-medium text-white">
              {item.unreadCount}
            </span>
          ) : null}
          {item.unread === true && (item.unreadCount ?? 0) === 0 ? (
            <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--llx-header-primary)]" />
          ) : null}
        </a>
      ))}
    </div>
  );
}

function groupBySection(items: ReadonlyArray<ChannelListItem>) {
  return {
    shortcuts: items.filter((item) => item.section === "shortcuts"),
    dm: items.filter((item) => item.section === "dm"),
    channels: items.filter((item) => item.section === "channels"),
  } as const;
}

/**
 * Channel/DM サイドバーUIを描画する。
 */
export function ChannelSidebar({ sectionLabel, items }: ChannelSidebarProps) {
  const groupedItems = groupBySection(items);

  return (
    <div className="space-y-4 p-3">
      <p className="px-2 text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        {sectionLabel}
      </p>

      {Object.entries(groupedItems).map(([section, sectionItems]) => {
        if (sectionItems.length === 0) {
          return null;
        }

        return (
          <section key={section} className="space-y-1">
            <p className="px-2 text-[11px] uppercase tracking-[0.15em] text-[var(--llx-text-muted)]">
              {SECTION_LABEL_MAP[section as keyof typeof SECTION_LABEL_MAP]}
            </p>
            {sectionItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded px-2 py-2 text-sm transition",
                  item.selected
                    ? "bg-[var(--llx-bg-selected)] text-[var(--llx-text-primary)]"
                    : "text-[var(--llx-text-secondary)] hover:bg-[var(--llx-bg-selected)]",
                  item.unread === true && !item.selected && "text-[var(--llx-text-primary)]",
                  item.muted && !item.selected && "text-[var(--llx-interactive-muted)]",
                )}
                aria-current={item.selected ? "page" : undefined}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-xs text-[var(--llx-channels-default)]">
                    {KIND_ICON_MAP[item.kind]}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {item.statusLabel !== undefined ? (
                    <span className="hidden text-[10px] text-[var(--llx-text-muted)] md:inline">
                      {item.statusLabel}
                    </span>
                  ) : null}
                </span>

                {(item.unreadCount ?? 0) > 0 ? (
                  <span className="ml-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--llx-header-primary)] px-1 text-[10px] font-medium text-[var(--llx-bg-tertiary)]">
                    {item.unreadCount}
                  </span>
                ) : null}
              </a>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/**
 * メンバーリストUIを描画する。
 */
export function ChannelMemberList({ items }: ChannelMemberListProps) {
  return (
    <div className="space-y-2 p-3">
      <p className="px-1 text-xs uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
        Members
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded bg-[var(--llx-bg-primary)] px-2 py-2 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn("h-2 w-2 rounded-full", PRESENCE_CLASS_MAP[item.presence])}
            />
            <span className="truncate text-[var(--llx-text-secondary)]">{item.name}</span>
          </span>
          {item.roleLabel !== undefined ? (
            <span className="text-[10px] text-[var(--llx-text-muted)]">{item.roleLabel}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
