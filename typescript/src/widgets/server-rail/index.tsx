import { classNames } from "@/shared";

type ServerRailVisualState = {
  isSelected?: boolean;
  isHovered?: boolean;
  hasUnread?: boolean;
  mentionCount?: number;
};

export type ServerRailItem = ServerRailVisualState & {
  id: string;
  label: string;
  iconLabel?: string;
  onSelect?: (id: string) => void;
};

export type ServerRailProps = {
  items: ServerRailItem[];
  ariaLabel?: string;
};

type ServerRailStateKey = "default" | "hovered" | "selected";

type ServerRailStateClasses = {
  indicator: string;
  button: string;
  label: string;
};

const serverRailStateClassMap: Record<ServerRailStateKey, ServerRailStateClasses> = {
  default: {
    indicator: "h-2 w-2 rounded-full opacity-0",
    button: "rounded-3xl bg-discord-dark text-white/80",
    label: "text-white/80",
  },
  hovered: {
    indicator: "h-5 w-1 rounded-r-full opacity-100",
    button: "rounded-2xl bg-discord-darker text-white",
    label: "text-white",
  },
  selected: {
    indicator: "h-10 w-1 rounded-r-full opacity-100",
    button: "rounded-2xl bg-discord-primary text-white",
    label: "text-white",
  },
};

function getServerRailStateKey(item: ServerRailVisualState): ServerRailStateKey {
  if (item.isSelected) {
    return "selected";
  }

  if (item.isHovered) {
    return "hovered";
  }

  return "default";
}

function getServerRailStateClasses(item: ServerRailVisualState): ServerRailStateClasses {
  const stateKey = getServerRailStateKey(item);
  const stateClasses = serverRailStateClassMap[stateKey];

  if (stateKey === "default" && item.hasUnread) {
    return {
      ...stateClasses,
      indicator: "h-2 w-2 rounded-full opacity-100",
      label: "text-white",
    };
  }

  return stateClasses;
}

function formatMentionCount(mentionCount: number): string {
  return mentionCount > 99 ? "99+" : String(mentionCount);
}

function normalizeMentionCount(mentionCount: number | undefined): number {
  if (!mentionCount || mentionCount <= 0) {
    return 0;
  }

  return mentionCount;
}

function resolveIconLabel(item: ServerRailItem): string {
  const iconLabel = item.iconLabel?.trim();

  if (iconLabel && iconLabel.length > 0) {
    return iconLabel.slice(0, 2).toUpperCase();
  }

  const fallbackLabel = item.label.trim().slice(0, 2).toUpperCase();
  return fallbackLabel.length > 0 ? fallbackLabel : "??";
}

/**
 * サーバーレールの項目一覧を表示する。
 *
 * Contract:
 * - state 表現（選択/ホバー/未読/メンション）は `ServerRailItem` の props で切り替える
 * - `mentionCount` が 100 以上の場合は `99+` 表示に丸める
 */
export function ServerRail({ items, ariaLabel = "Servers" }: ServerRailProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex w-[72px] flex-col items-center border-r border-white/10 bg-discord-darkest py-3"
    >
      <ul className="flex w-full flex-col items-center gap-2">
        {items.map((item) => {
          const stateClasses = getServerRailStateClasses(item);
          const mentionCount = normalizeMentionCount(item.mentionCount);

          return (
            <li key={item.id} className="relative flex w-full justify-center">
              <span
                aria-hidden="true"
                data-testid={`server-rail-indicator-${item.id}`}
                className={classNames(
                  "absolute left-0 top-1/2 -translate-y-1/2 bg-white transition-all",
                  stateClasses.indicator
                )}
              />
              <button
                type="button"
                aria-label={item.label}
                data-testid={`server-rail-item-${item.id}`}
                onClick={() => item.onSelect?.(item.id)}
                className={classNames(
                  "relative flex h-12 w-12 items-center justify-center font-semibold transition-all",
                  "hover:rounded-2xl hover:bg-discord-primary hover:text-white",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-discord-primary/70",
                  stateClasses.button
                )}
              >
                <span className={classNames("text-sm leading-none", stateClasses.label)}>
                  {resolveIconLabel(item)}
                </span>
                {mentionCount > 0 ? (
                  <span
                    data-testid={`server-rail-mention-${item.id}`}
                    className="absolute -bottom-1 -right-1 rounded-full bg-discord-red px-1.5 text-[10px] font-bold leading-4 text-white"
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
  );
}
