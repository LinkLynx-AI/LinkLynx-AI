import type { PlaceholderState } from "@/shared/config";

type ShellStatePlaceholderProps = {
  state: PlaceholderState;
  title?: string;
  description?: string;
};

type StateContent = {
  label: string;
  title: string;
  description: string;
  accentClassName: string;
};

const STATE_CONTENT_MAP: Record<PlaceholderState, StateContent> = {
  loading: {
    label: "Loading",
    title: "データを読み込み中です",
    description: "接続先の準備ができるまで少しお待ちください。",
    accentClassName: "bg-[var(--llx-brand-blurple)]",
  },
  empty: {
    label: "Empty",
    title: "まだ表示できるデータがありません",
    description: "最初のコンテンツが作成されると、ここに表示されます。",
    accentClassName: "bg-[var(--llx-channels-default)]",
  },
  error: {
    label: "Error",
    title: "表示に失敗しました",
    description: "時間をおいて再試行するか、別画面へ移動してください。",
    accentClassName: "bg-[var(--llx-brand-red)]",
  },
  readonly: {
    label: "Readonly",
    title: "閲覧専用モードです",
    description: "現在の権限では表示のみ可能です。編集はできません。",
    accentClassName: "bg-[var(--llx-brand-yellow)]",
  },
  disabled: {
    label: "Disabled",
    title: "この操作は無効化されています",
    description: "設定が有効になるまで、この導線は選択できません。",
    accentClassName: "bg-[var(--llx-interactive-muted)]",
  },
};

/**
 * 共通状態プレースホルダを描画する。
 */
export function ShellStatePlaceholder({ state, title, description }: ShellStatePlaceholderProps) {
  const content = STATE_CONTENT_MAP[state];

  return (
    <section className="w-full rounded-lg border border-[var(--llx-divider)] bg-[var(--llx-bg-secondary)] p-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`inline-flex h-2.5 w-2.5 rounded-full ${content.accentClassName}`}
        />
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--llx-header-secondary)]">
          {content.label}
        </p>
      </div>

      <h2 className="mt-4 text-xl font-semibold text-[var(--llx-text-primary)]">
        {title ?? content.title}
      </h2>
      <p className="mt-2 text-sm text-[var(--llx-text-muted)]">
        {description ?? content.description}
      </p>
    </section>
  );
}
