import { ChannelShellLayout } from "./channel-shell-layout";
import { SettingsShellLayout } from "./settings-shell-layout";
import { ShellStatePlaceholder } from "./shell-state-placeholder";

export { ChannelShellLayout, ShellStatePlaceholder, SettingsShellLayout };
export { CorePrimitivesPreview } from "./core-primitives-preview";

type AppShellPlaceholderProps = {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
};

/**
 * UI基盤のApp Shellプレースホルダを描画する。
 */
export function AppShellPlaceholder({ title, subtitle, children }: AppShellPlaceholderProps) {
  return (
    <section className="w-full max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-xl">
      <header>
        <h1 className="font-display text-3xl font-bold text-primary">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </header>
      <div className="mt-6 flex items-center gap-3">{children}</div>
    </section>
  );
}
