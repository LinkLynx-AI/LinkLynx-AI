import type { CSSProperties } from "react";
import { themeTokens } from "@/shared/config";

const previewCardStyle: CSSProperties = {
  backgroundColor: "var(--color-bg-canvas)",
  borderColor: "var(--color-border-subtle)",
  color: "var(--color-text-primary)",
};

const surfaceStyle: CSSProperties = {
  backgroundColor: "var(--color-surface-default)",
  borderColor: "var(--color-border-subtle)",
};

const primaryButtonStyle: CSSProperties = {
  backgroundColor: "var(--color-accent)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-on-accent)",
};

const secondaryButtonStyle: CSSProperties = {
  backgroundColor: "var(--color-surface-muted)",
  borderColor: "var(--color-border-subtle)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)",
};

const themeOrder = ["dark", "light"] as const;

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-accent)" }}>
            Theme Tokens Preview
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            ライト/ダークで共通利用するデザイントークンを定義し、同じUIがテーマ変数で切り替わる状態を確認できます。
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          {themeOrder.map((themeName) => {
            const token = themeTokens[themeName];

            return (
              <article
                key={themeName}
                data-theme={themeName}
                className="rounded-xl border p-5 shadow-sm"
                style={previewCardStyle}
              >
                <h2 className="text-base font-semibold">{themeName === "dark" ? "Dark theme" : "Light theme"}</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  色・余白・タイポグラフィを同一キーで管理しています。
                </p>

                <div className="mt-4 space-y-4 rounded-lg border p-4" style={surfaceStyle}>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-sm font-semibold transition hover:opacity-90"
                      style={primaryButtonStyle}
                    >
                      Primary
                    </button>
                    <button
                      type="button"
                      disabled
                      className="border px-3 py-1.5 text-sm opacity-60"
                      style={secondaryButtonStyle}
                    >
                      Disabled
                    </button>
                  </div>

                  <div
                    className="h-2 rounded"
                    style={{ backgroundColor: "var(--color-accent-muted)" }}
                  />

                  <dl className="space-y-1 text-xs">
                    <div>
                      <dt className="inline font-semibold">bgCanvas:</dt>{" "}
                      <dd className="inline">{token.colors.bgCanvas}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">surfaceDefault:</dt>{" "}
                      <dd className="inline">{token.colors.surfaceDefault}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">spacing.lg:</dt>{" "}
                      <dd className="inline">{token.spacing.lg}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">typography.title:</dt>{" "}
                      <dd className="inline">{token.typography.title}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
