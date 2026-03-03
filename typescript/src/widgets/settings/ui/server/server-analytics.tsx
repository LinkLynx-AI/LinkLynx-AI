"use client";

import { useState, useMemo } from "react";
import { cn } from "@/shared/lib/cn";
import { mockDailyStats, mockChannelActivity } from "@/shared/api/mock/data/analytics";

type Period = 7 | 30 | 90;

const periodOptions: { value: Period; label: string }[] = [
  { value: 7, label: "7日" },
  { value: 30, label: "30日" },
  { value: 90, label: "90日" },
];

export function ServerAnalytics({ serverId }: { serverId: string }) {
  const [period, setPeriod] = useState<Period>(30);

  const filteredStats = useMemo(() => {
    return mockDailyStats.slice(-Math.min(period, mockDailyStats.length));
  }, [period]);

  const summary = useMemo(() => {
    if (filteredStats.length === 0) {
      return { totalMembers: 0, activeMembers: 0, newMembers: 0, messageCount: 0 };
    }
    const last = filteredStats[filteredStats.length - 1];
    const totalNew = filteredStats.reduce((sum, d) => sum + d.newMembers, 0);
    const avgActive = Math.round(
      filteredStats.reduce((sum, d) => sum + d.activeMembers, 0) / filteredStats.length,
    );
    const totalMessages = filteredStats.reduce((sum, d) => sum + d.messageCount, 0);
    return {
      totalMembers: last.totalMembers,
      activeMembers: avgActive,
      newMembers: totalNew,
      messageCount: totalMessages,
    };
  }, [filteredStats]);

  const maxMessageCount = useMemo(() => {
    return Math.max(...filteredStats.map((d) => d.messageCount), 1);
  }, [filteredStats]);

  const topChannels = mockChannelActivity.slice(0, 5);
  const maxChannelMessages = topChannels.length > 0 ? topChannels[0].messageCount : 1;

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">サーバーインサイト</h2>

      {/* Period selector */}
      <div className="mb-6 flex gap-2">
        {periodOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              period === opt.value
                ? "bg-discord-brand-blurple text-white"
                : "bg-discord-bg-secondary text-discord-text-muted hover:text-discord-text-normal",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        {[
          { label: "総メンバー", value: summary.totalMembers.toLocaleString() },
          { label: "アクティブメンバー", value: summary.activeMembers.toLocaleString() },
          { label: "新規メンバー", value: `+${summary.newMembers}` },
          { label: "メッセージ送信数", value: summary.messageCount.toLocaleString() },
        ].map((card) => (
          <div key={card.label} className="rounded-lg bg-discord-bg-secondary p-4">
            <p className="text-xs text-discord-text-muted">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-discord-header-primary">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Member growth chart */}
      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          メッセージ推移
        </h3>
        <div className="flex h-40 items-end gap-px rounded-lg bg-discord-bg-secondary p-4">
          {filteredStats.map((day) => {
            const heightPercent = (day.messageCount / maxMessageCount) * 100;
            return (
              <div
                key={day.date}
                className="group relative flex-1"
                title={`${day.date}: ${day.messageCount}件`}
              >
                <div
                  className="w-full rounded-t bg-discord-brand-blurple transition-opacity hover:opacity-80"
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Channel activity */}
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          チャンネルアクティビティ
        </h3>
        <div className="space-y-3">
          {topChannels.map((ch) => {
            const widthPercent = (ch.messageCount / maxChannelMessages) * 100;
            return (
              <div key={ch.channelId} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-sm text-discord-text-normal">
                  #{ch.channelName}
                </span>
                <div className="flex-1">
                  <div className="h-5 w-full rounded bg-discord-bg-tertiary">
                    <div
                      className="h-full rounded bg-discord-brand-blurple"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
                <span className="w-16 text-right text-xs text-discord-text-muted">
                  {ch.messageCount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
