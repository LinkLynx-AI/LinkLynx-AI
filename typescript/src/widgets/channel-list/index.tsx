import { classNames } from "@/shared";

type ChannelListVisualState = {
  isSelected?: boolean;
  isHovered?: boolean;
  hasUnread?: boolean;
  mentionCount?: number;
};

export type ChannelListItemKind = "channel" | "dm";

export type ChannelListItem = ChannelListVisualState & {
  id: string;
  label: string;
  kind?: ChannelListItemKind;
  onSelect?: (id: string) => void;
};

export type ChannelListProps = {
  items: ChannelListItem[];
  title?: string;
  ariaLabel?: string;
};

type ChannelListStateKey = "default" | "hovered" | "selected";

type ChannelListStateClasses = {
  indicator: string;
  button: string;
  prefix: string;
  label: string;
};

const channelListStateClassMap: Record<ChannelListStateKey, ChannelListStateClasses> = {
  default: {
    indicator: "h-2 w-2 rounded-full opacity-0",
    button: "bg-transparent",
    prefix: "text-white/50",
    label: "text-white/70",
  },
  hovered: {
    indicator: "h-4 w-1 rounded-r-full opacity-100",
    button: "bg-white/10",
    prefix: "text-white/80",
    label: "text-white",
  },
  selected: {
    indicator: "h-6 w-1 rounded-r-full opacity-100",
    button: "bg-white/15",
    prefix: "text-white",
    label: "text-white",
  },
};

function getChannelListStateKey(item: ChannelListVisualState): ChannelListStateKey {
  if (item.isSelected) {
    return "selected";
  }

  if (item.isHovered) {
    return "hovered";
  }

  return "default";
}

function getChannelListStateClasses(item: ChannelListVisualState): ChannelListStateClasses {
  const stateKey = getChannelListStateKey(item);
  const stateClasses = channelListStateClassMap[stateKey];

  if (stateKey === "default" && item.hasUnread) {
    return {
      ...stateClasses,
      indicator: "h-2 w-2 rounded-full opacity-100",
      prefix: "text-white",
      label: "text-white",
    };
  }

  return stateClasses;
}

function normalizeMentionCount(mentionCount: number | undefined): number {
  if (!mentionCount || mentionCount <= 0) {
    return 0;
  }

  return mentionCount;
}

function formatMentionCount(mentionCount: number): string {
  return mentionCount > 99 ? "99+" : String(mentionCount);
}

function resolveItemPrefix(item: ChannelListItem): string {
  return item.kind === "dm" ? "@" : "#";
}

/**
 * チャンネル/DM リストを表示する。
 *
 * Contract:
 * - state 表現（選択/ホバー/未読/メンション）は `ChannelListItem` の props で切り替える
 * - `mentionCount` が 100 以上の場合は `99+` 表示に丸める
 */
export function ChannelList({
  items,
  title,
  ariaLabel = "Channel list",
}: ChannelListProps) {
  return (
    <aside className="flex w-60 flex-col border-r border-white/10 bg-discord-dark py-3">
      <nav aria-label={ariaLabel} className="flex-1">
        {title ? (
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
            {title}
          </p>
        ) : null}
        <ul className="space-y-1 px-2">
          {items.map((item) => {
            const stateClasses = getChannelListStateClasses(item);
            const mentionCount = normalizeMentionCount(item.mentionCount);

            return (
              <li key={item.id} className="relative">
                <span
                  aria-hidden="true"
                  data-testid={`channel-list-indicator-${item.id}`}
                  className={classNames(
                    "absolute left-0 top-1/2 -translate-y-1/2 bg-white transition-all",
                    stateClasses.indicator
                  )}
                />
                <button
                  type="button"
                  aria-label={item.label}
                  data-testid={`channel-list-item-${item.id}`}
                  onClick={() => item.onSelect?.(item.id)}
                  className={classNames(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                    "hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-discord-primary/70",
                    stateClasses.button
                  )}
                >
                  <span
                    data-testid={`channel-list-prefix-${item.id}`}
                    className={classNames("shrink-0 text-sm font-semibold", stateClasses.prefix)}
                  >
                    {resolveItemPrefix(item)}
                  </span>
                  <span
                    className={classNames(
                      "min-w-0 flex-1 truncate font-medium",
                      stateClasses.label
                    )}
                  >
                    {item.label}
                  </span>
                  {mentionCount > 0 ? (
                    <span
                      data-testid={`channel-list-mention-${item.id}`}
                      className="ml-2 rounded-full bg-discord-red px-1.5 text-[10px] font-bold leading-4 text-white"
                    >
                      {formatMentionCount(mentionCount)}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
