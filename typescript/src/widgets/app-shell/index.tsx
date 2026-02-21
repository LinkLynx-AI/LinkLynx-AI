import type { ReactNode } from "react";

type AppShellFrameBaseProps = {
  headerSlot?: ReactNode;
  serverRailSlot: ReactNode;
  listSlot: ReactNode;
  mainSlot: ReactNode;
};

type AppShellFrameWithRightPanel = {
  isRightPanelOpen: true;
  rightPanelSlot: ReactNode;
};

type AppShellFrameWithoutRightPanel = {
  isRightPanelOpen?: false;
  rightPanelSlot?: never;
};

type AppShellFrameLegacyProps = {
  headerSlot?: ReactNode;
  sidebarSlot?: ReactNode;
  contentSlot: ReactNode;
  serverRailSlot?: never;
  listSlot?: never;
  mainSlot?: never;
  isRightPanelOpen?: never;
  rightPanelSlot?: never;
};

export type AppShellFrameProps =
  | (AppShellFrameBaseProps &
      (AppShellFrameWithRightPanel | AppShellFrameWithoutRightPanel))
  | AppShellFrameLegacyProps;

export type AppShellSlots = AppShellFrameProps;

type ResolvedAppShellFrameProps = {
  headerSlot?: ReactNode;
  serverRailSlot: ReactNode;
  listSlot: ReactNode;
  mainSlot: ReactNode;
  isRightPanelOpen: boolean;
  rightPanelSlot?: ReactNode;
};

function isLegacyProps(props: AppShellFrameProps): props is AppShellFrameLegacyProps {
  return "contentSlot" in props;
}

function resolveAppShellFrameProps(props: AppShellFrameProps): ResolvedAppShellFrameProps {
  if (isLegacyProps(props)) {
    return {
      headerSlot: props.headerSlot,
      serverRailSlot: props.sidebarSlot ?? null,
      listSlot: null,
      mainSlot: props.contentSlot,
      isRightPanelOpen: false,
    };
  }

  return {
    headerSlot: props.headerSlot,
    serverRailSlot: props.serverRailSlot,
    listSlot: props.listSlot,
    mainSlot: props.mainSlot,
    isRightPanelOpen: props.isRightPanelOpen ?? false,
    rightPanelSlot: props.rightPanelSlot,
  };
}

/**
 * Discord系3カラムUIの骨格を提供する。
 *
 * Contract:
 * - `serverRailSlot` / `listSlot` / `mainSlot` は必須
 * - `headerSlot` は任意
 * - `isRightPanelOpen=true` のとき `rightPanelSlot` は必須
 */
export function AppShellFrame(props: AppShellFrameProps) {
  const {
    headerSlot,
    serverRailSlot,
    listSlot,
    mainSlot,
    isRightPanelOpen,
    rightPanelSlot,
  } = resolveAppShellFrameProps(props);

  const gridColumnClass = isRightPanelOpen
    ? "grid-cols-[72px_280px_minmax(0,1fr)_320px]"
    : "grid-cols-[72px_280px_minmax(0,1fr)]";

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-discord-darkest text-white">
      {headerSlot ? (
        <header aria-label="app-shell-header" className="shrink-0 border-b border-white/10 px-6 py-4">
          {headerSlot}
        </header>
      ) : null}

      <div className={`grid min-h-0 flex-1 overflow-hidden ${gridColumnClass}`} data-testid="app-shell-grid">
        <nav
          aria-label="app-shell-server-rail"
          className="min-w-0 overflow-y-auto border-r border-white/10 bg-discord-dark px-3 py-4"
        >
          {serverRailSlot}
        </nav>
        <aside
          aria-label="app-shell-list"
          className="min-w-0 overflow-y-auto border-r border-white/10 bg-discord-dark px-4 py-4"
        >
          {listSlot}
        </aside>
        <main aria-label="app-shell-main" className="min-w-0 overflow-y-auto bg-discord-darker px-8 py-6">
          {mainSlot}
        </main>
        {isRightPanelOpen ? (
          <aside
            aria-label="app-shell-right-panel"
            className="min-w-0 overflow-y-auto border-l border-white/10 bg-discord-dark px-4 py-4"
          >
            {rightPanelSlot}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
