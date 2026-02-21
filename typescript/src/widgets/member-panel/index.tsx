import { MemberAvatar, type MemberSummary } from "@/entities";

export type MemberPanelProps = {
  members: MemberSummary[];
  title?: string;
};

/**
 * 右サイドのメンバー一覧パネルを表示する。
 *
 * Contract:
 * - メンバー表示は `MemberAvatar` を再利用する
 * - パネル開閉時のレイアウト遷移を阻害しないよう `min-w-0` と `overflow` を調整する
 */
export function MemberPanel({ members, title = "Members" }: MemberPanelProps) {
  return (
    <section aria-label="member-panel" className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-white/10 pb-3">
        <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-white/70">{title}</h2>
        <p className="mt-1 text-xs text-white/50">{members.length} members</p>
      </header>

      {members.length > 0 ? (
        <ul aria-label="member-panel-list" className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {members.map((member) => (
            <li className="rounded-md px-2 py-1 transition-colors hover:bg-white/5" key={member.id}>
              <MemberAvatar member={member} size="sm" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-white/60">表示できるメンバーはいません。</p>
      )}
    </section>
  );
}
