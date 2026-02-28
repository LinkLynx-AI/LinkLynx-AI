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
  shortcuts: "サイドバー",
  dm: "ダイレクトメッセージ",
  channels: "テキストチャンネル",
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
    <div className="flex h-full flex-col items-center gap-2 px-3 py-3">
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--llx-brand-blurple)] text-xs font-bold text-white"
        aria-label="Discord Home"
      >
        LL
      </button>

      <div className="h-px w-8 bg-[var(--llx-divider)]/60" />

      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className="group relative block"
          aria-label={item.label}
          aria-current={item.selected ? "page" : undefined}
        >
          <span
            aria-hidden
            className={cn(
              "absolute -left-3 top-1/2 -translate-y-1/2 rounded-r-full bg-white transition-all duration-150",
              item.selected && "h-10 w-1",
              !item.selected && item.unread === true && "h-2 w-1",
              !item.selected && item.unread !== true && "h-0 w-0",
            )}
          />

          <span
            className={cn(
              "relative flex h-12 w-12 items-center justify-center text-[11px] font-semibold transition-all duration-150",
              item.selected
                ? "rounded-2xl bg-[var(--llx-brand-blurple)] text-white"
                : "rounded-full bg-[var(--llx-bg-primary)] text-[var(--llx-text-secondary)] group-hover:rounded-2xl group-hover:bg-[var(--llx-brand-blurple)] group-hover:text-white",
              item.muted && !item.selected && "text-[var(--llx-interactive-muted)]",
            )}
          >
            {item.label}
            {(item.unreadCount ?? 0) > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--llx-brand-red)] px-1 text-[10px] font-semibold text-white">
                {item.unreadCount}
              </span>
            ) : null}
          </span>
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

function SidebarItem({ item }: { item: ChannelListItem }) {
  return (
    <a
      href={item.href}
      className={cn(
        "group flex items-center justify-between rounded px-2 py-1 text-[15px] leading-5 transition",
        item.selected
          ? "bg-[var(--llx-bg-selected)] text-[var(--llx-text-primary)]"
          : "text-[var(--llx-text-secondary)] hover:bg-[var(--llx-bg-selected)] hover:text-[var(--llx-text-primary)]",
        item.unread === true && !item.selected && "text-[var(--llx-text-primary)]",
        item.muted && !item.selected && "text-[var(--llx-interactive-muted)]",
      )}
      aria-current={item.selected ? "page" : undefined}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="w-4 shrink-0 text-center text-[13px] text-[var(--llx-channels-default)]">
          {KIND_ICON_MAP[item.kind]}
        </span>
        <span className="truncate">{item.label}</span>
      </span>

      <span className="ml-2 flex shrink-0 items-center gap-1">
        {item.statusLabel !== undefined ? (
          <span className="hidden text-[10px] text-[var(--llx-text-muted)] md:inline">
            {item.statusLabel}
          </span>
        ) : null}

        {(item.unreadCount ?? 0) > 0 ? (
          <span className="inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--llx-header-primary)] px-1 text-[10px] font-semibold text-[var(--llx-bg-tertiary)]">
            {item.unreadCount}
          </span>
        ) : null}
      </span>
    </a>
  );
}

function SidebarSection({
  label,
  items,
}: {
  label: string;
  items: ReadonlyArray<ChannelListItem>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-0.5">
      <div className="flex items-center justify-between px-2 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--llx-channels-default)]">
          {label}
        </p>
        <span className="text-[13px] text-[var(--llx-channels-default)]">＋</span>
      </div>
      {items.map((item) => (
        <SidebarItem key={item.id} item={item} />
      ))}
    </section>
  );
}

/**
 * Channel/DM サイドバーUIを描画する。
 */
export function ChannelSidebar({ sectionLabel, items }: ChannelSidebarProps) {
  const groupedItems = groupBySection(items);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center justify-between border-b border-black/20 px-4 shadow-[0_1px_0_rgba(0,0,0,0.24)]">
        <p className="truncate text-[15px] font-semibold text-[var(--llx-header-primary)]">
          {sectionLabel}
        </p>
        <span className="text-[12px] text-[var(--llx-channels-default)]">⌄</span>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto px-2 pb-3 pt-2">
        {Object.entries(groupedItems).map(([section, sectionItems]) => (
          <SidebarSection
            key={section}
            label={SECTION_LABEL_MAP[section as keyof typeof SECTION_LABEL_MAP]}
            items={sectionItems}
          />
        ))}
      </div>

      <footer className="flex items-center justify-between border-t border-black/20 bg-black/20 px-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--llx-bg-selected)] text-[11px] font-semibold text-white">
            SB
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--llx-bg-secondary)] bg-emerald-500" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--llx-header-primary)]">sabe</p>
            <p className="truncate text-[10px] text-[var(--llx-text-muted)]">オンライン</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[13px] text-[var(--llx-channels-default)]">
          <button
            type="button"
            className="rounded p-1 transition hover:bg-black/20"
            aria-label="Mute"
          >
            🎙
          </button>
          <button
            type="button"
            className="rounded p-1 transition hover:bg-black/20"
            aria-label="Headset"
          >
            🎧
          </button>
          <button
            type="button"
            className="rounded p-1 transition hover:bg-black/20"
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </footer>
    </div>
  );
}

function splitMembers(items: ReadonlyArray<MemberListItem>) {
  return {
    online: items.filter((item) => item.presence !== "offline"),
    offline: items.filter((item) => item.presence === "offline"),
  } as const;
}

function MemberRow({ item }: { item: MemberListItem }) {
  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-black/10">
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--llx-bg-primary)] text-[11px] font-semibold text-[var(--llx-text-primary)]">
        {item.name.slice(0, 2).toUpperCase()}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--llx-bg-secondary)]",
            PRESENCE_CLASS_MAP[item.presence],
          )}
        />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-[var(--llx-text-secondary)] group-hover:text-[var(--llx-text-primary)]">
          {item.name}
        </p>
        {item.roleLabel !== undefined ? (
          <p className="truncate text-[10px] text-[var(--llx-text-muted)]">{item.roleLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * メンバーリストUIを描画する。
 */
export function ChannelMemberList({ items }: ChannelMemberListProps) {
  const grouped = splitMembers(items);

  return (
    <div className="h-full overflow-auto px-2 py-3">
      <section className="space-y-1">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--llx-channels-default)]">
          オンライン - {grouped.online.length}
        </p>
        {grouped.online.map((item) => (
          <MemberRow key={item.id} item={item} />
        ))}
      </section>

      <section className="mt-4 space-y-1">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--llx-channels-default)]">
          オフライン - {grouped.offline.length}
        </p>
        {grouped.offline.map((item) => (
          <MemberRow key={item.id} item={item} />
        ))}
      </section>
    </div>
  );
}
