import { classNames } from "@/shared";

export type ChatHeaderProps = {
  title: string;
  subtitle?: string;
  isMemberPanelOpen: boolean;
  onToggleMemberPanel: () => void;
};

/**
 * 会話ヘッダーとメンバーパネル切替トリガーを表示する。
 *
 * Contract:
 * - `isMemberPanelOpen` を `aria-pressed` に反映する
 * - 右パネル開閉時のレイアウト遷移を阻害しないよう `min-w-0` を維持する
 */
export function ChatHeader({
  title,
  subtitle,
  isMemberPanelOpen,
  onToggleMemberPanel,
}: ChatHeaderProps) {
  return (
    <header
      aria-label="chat-header"
      className="flex w-full min-w-0 items-center justify-between gap-3"
      data-testid="chat-header"
    >
      <div className="min-w-0 flex-1">
        {subtitle ? (
          <p className="truncate text-xs font-medium uppercase tracking-wide text-white/60">{subtitle}</p>
        ) : null}
        <h2 className="truncate text-lg font-semibold text-white">{title}</h2>
      </div>
      <button
        aria-label="メンバーパネルを開閉"
        aria-pressed={isMemberPanelOpen}
        className={classNames(
          "shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
          isMemberPanelOpen
            ? "border-discord-primary bg-discord-primary/15 text-discord-primary"
            : "border-white/20 bg-transparent text-white/80 hover:bg-white/10"
        )}
        onClick={onToggleMemberPanel}
        type="button"
      >
        メンバー
      </button>
    </header>
  );
}
