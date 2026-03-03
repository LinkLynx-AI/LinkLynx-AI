"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

const currentBoosts = 9;
const currentTier = 2;

const tierThresholds = [
  { tier: 1, boosts: 2, label: "ティア 1" },
  { tier: 2, boosts: 7, label: "ティア 2" },
  { tier: 3, boosts: 14, label: "ティア 3" },
];

const perks = [
  {
    tier: 1,
    label: "ティア 1",
    boosts: 2,
    items: ["絵文字50→100スロット", "音質128kbps", "カスタム招待背景"],
  },
  {
    tier: 2,
    label: "ティア 2",
    boosts: 7,
    items: ["絵文字50→150スロット", "音質256kbps", "サーバーバナー", "50MBアップロード"],
  },
  {
    tier: 3,
    label: "ティア 3",
    boosts: 14,
    items: [
      "絵文字50→250スロット",
      "音質384kbps",
      "アニメーションアイコン",
      "100MBアップロード",
      "カスタムURL",
    ],
  },
];

const mockBoosters = [
  { id: "b1", name: "Taro", date: "2026-01-15" },
  { id: "b2", name: "Hana", date: "2026-01-18" },
  { id: "b3", name: "Yuki", date: "2026-01-22" },
  { id: "b4", name: "Kenta", date: "2026-02-01" },
  { id: "b5", name: "Mika", date: "2026-02-05" },
  { id: "b6", name: "Sora", date: "2026-02-10" },
  { id: "b7", name: "Ryo", date: "2026-02-14" },
  { id: "b8", name: "Aoi", date: "2026-02-20" },
  { id: "b9", name: "Ren", date: "2026-02-25" },
];

const maxBoosts = 14;

const tierColors = {
  1: "bg-[#43b581]",
  2: "bg-[#5865f2]",
  3: "bg-[#9b59b6]",
} as const;

const comparisonFeatures = [
  { label: "絵文字スロット", values: ["100", "150", "250"] },
  { label: "音質", values: ["128kbps", "256kbps", "384kbps"] },
  { label: "アップロード上限", values: ["25MB", "50MB", "100MB"] },
  { label: "カスタム招待背景", values: [true, true, true] },
  { label: "サーバーバナー", values: [false, true, true] },
  { label: "アニメーションアイコン", values: [false, false, true] },
  { label: "カスタムURL", values: [false, false, true] },
];

export function ServerBoost({ serverId }: { serverId: string }) {
  const progressPercent = Math.min((currentBoosts / maxBoosts) * 100, 100);

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">サーバーブースト</h2>

      {/* Current tier */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5865f2] to-[#eb459e]">
          <span className="text-3xl font-bold text-white">{currentTier}</span>
        </div>
        <div>
          <p className="text-lg font-bold text-discord-header-primary">ティア {currentTier}</p>
          <p className="text-sm text-discord-text-muted">{currentBoosts} ブースト</p>
        </div>
      </div>

      {/* Segmented tier progress bar */}
      <div className="mb-8">
        <div className="relative mb-2">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-discord-bg-tertiary">
            {tierThresholds.map((t, i) => {
              const prevBoosts = i === 0 ? 0 : tierThresholds[i - 1].boosts;
              const segmentWidth = ((t.boosts - prevBoosts) / maxBoosts) * 100;
              const segmentFill = Math.max(
                0,
                Math.min(1, (currentBoosts - prevBoosts) / (t.boosts - prevBoosts)),
              );
              return (
                <div key={t.tier} className="relative h-full" style={{ width: `${segmentWidth}%` }}>
                  <div
                    className={cn("h-full transition-all", tierColors[t.tier as 1 | 2 | 3])}
                    style={{ width: `${segmentFill * 100}%` }}
                  />
                  {i < tierThresholds.length - 1 && (
                    <div className="absolute right-0 top-0 h-full w-0.5 bg-discord-bg-primary" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Tier markers */}
          {tierThresholds.map((t) => (
            <div
              key={t.tier}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${(t.boosts / maxBoosts) * 100}%`, transform: "translateX(-50%)" }}
            >
              <div className="h-4 w-0.5 bg-discord-bg-primary" />
              <span className="mt-1 text-[10px] text-discord-text-muted whitespace-nowrap">
                {t.label} ({t.boosts})
              </span>
            </div>
          ))}
          {/* Current position indicator */}
          <div
            className="absolute -top-1 h-6 w-1 rounded-full bg-white shadow"
            style={{
              left: `${progressPercent}%`,
              transform: "translateX(-50%)",
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-discord-text-muted">
          <span>0</span>
          <span>{maxBoosts}</span>
        </div>
      </div>

      {/* Tier comparison table */}
      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          ティア比較
        </h3>
        <div className="overflow-hidden rounded-lg bg-discord-bg-secondary">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-discord-divider">
                <th className="px-4 py-3 text-left font-medium text-discord-header-secondary">
                  機能
                </th>
                {perks.map((p) => (
                  <th
                    key={p.tier}
                    className={cn(
                      "px-4 py-3 text-center font-semibold",
                      currentTier >= p.tier
                        ? "text-discord-header-primary"
                        : "text-discord-text-muted",
                    )}
                  >
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feature) => (
                <tr key={feature.label} className="border-b border-discord-divider last:border-0">
                  <td className="px-4 py-2.5 text-discord-text-normal">{feature.label}</td>
                  {feature.values.map((val, i) => (
                    <td key={i} className="px-4 py-2.5 text-center">
                      {typeof val === "boolean" ? (
                        val ? (
                          <Check
                            size={16}
                            className={cn(
                              "mx-auto",
                              currentTier >= i + 1
                                ? "text-discord-status-online"
                                : "text-discord-text-muted",
                            )}
                          />
                        ) : (
                          <span className="text-discord-text-muted">-</span>
                        )
                      ) : (
                        <span
                          className={cn(
                            currentTier >= i + 1
                              ? "text-discord-text-normal"
                              : "text-discord-text-muted",
                          )}
                        >
                          {val}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Perks */}
      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">特典</h3>
        <div className="space-y-4">
          {perks.map((perkGroup) => (
            <div key={perkGroup.tier} className="rounded-lg bg-discord-bg-secondary p-4">
              <h4 className="mb-2 text-sm font-semibold text-discord-header-primary">
                {perkGroup.label}（{perkGroup.boosts} ブースト）
              </h4>
              <ul className="space-y-1.5">
                {perkGroup.items.map((item) => {
                  const unlocked = currentTier >= perkGroup.tier;
                  return (
                    <li key={item} className="flex items-center gap-2">
                      <Check
                        size={16}
                        className={cn(
                          unlocked ? "text-discord-status-online" : "text-discord-text-muted",
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm",
                          unlocked ? "text-discord-text-normal" : "text-discord-text-muted",
                        )}
                      >
                        {item}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Booster list */}
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          ブースター（{mockBoosters.length}）
        </h3>
        <div className="space-y-2">
          {mockBoosters.map((booster) => (
            <div
              key={booster.id}
              className="flex items-center gap-3 rounded-lg bg-discord-bg-secondary px-3 py-2"
            >
              <Avatar src={undefined} alt={booster.name} size={32} />
              <span className="flex-1 text-sm font-medium text-discord-text-normal">
                {booster.name}
              </span>
              <span className="text-xs text-discord-text-muted">{booster.date}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
