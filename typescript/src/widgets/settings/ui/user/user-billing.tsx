"use client";

import { useState } from "react";
import { CreditCard, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { mockPaymentMethods, mockBillingHistory } from "@/shared/api/mock/data/billing";

const cardIcons: Record<string, string> = {
  visa: "VISA",
  mastercard: "MC",
  paypal: "PayPal",
};

const statusLabels: Record<string, { label: string; className: string }> = {
  paid: {
    label: "支払い済み",
    className: "bg-discord-status-online/20 text-discord-status-online",
  },
  pending: {
    label: "保留中",
    className: "bg-discord-status-idle/20 text-discord-status-idle",
  },
  failed: {
    label: "失敗",
    className: "bg-discord-status-dnd/20 text-discord-status-dnd",
  },
};

export function UserBilling() {
  const [giftCode, setGiftCode] = useState("");

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">請求情報</h2>

      {/* Payment methods */}
      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          支払い方法
        </h3>
        <div className="space-y-2">
          {mockPaymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center gap-3 rounded-lg bg-discord-bg-secondary px-4 py-3"
            >
              <div className="flex h-8 w-12 items-center justify-center rounded bg-discord-bg-tertiary text-xs font-bold text-discord-text-muted">
                {cardIcons[method.type] ?? method.type}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-discord-text-normal">
                  •••• •••• •••• {method.last4}
                  {method.isDefault && (
                    <span className="ml-2 text-xs text-discord-text-muted">（デフォルト）</span>
                  )}
                </p>
                <p className="text-xs text-discord-text-muted">
                  有効期限: {method.expiresMonth.toString().padStart(2, "0")}/{method.expiresYear}
                </p>
              </div>
              <button
                className="p-1.5 text-discord-interactive-normal hover:text-discord-interactive-hover"
                aria-label="編集"
              >
                <Pencil size={16} />
              </button>
              <button
                className="p-1.5 text-discord-interactive-normal hover:text-discord-status-dnd"
                aria-label="削除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" className="mt-3">
          支払い方法を追加
        </Button>
      </section>

      {/* Billing history */}
      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">請求履歴</h3>
        <div className="overflow-hidden rounded-lg bg-discord-bg-secondary">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-discord-bg-tertiary">
                <th className="px-4 py-2.5 text-xs font-bold uppercase text-discord-header-secondary">
                  日付
                </th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase text-discord-header-secondary">
                  説明
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-bold uppercase text-discord-header-secondary">
                  金額
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-bold uppercase text-discord-header-secondary">
                  ステータス
                </th>
              </tr>
            </thead>
            <tbody>
              {mockBillingHistory.map((entry) => {
                const status = statusLabels[entry.status];
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-discord-bg-tertiary last:border-b-0"
                  >
                    <td className="px-4 py-2.5 text-discord-text-muted">{entry.date}</td>
                    <td className="px-4 py-2.5 text-discord-text-normal">{entry.description}</td>
                    <td className="px-4 py-2.5 text-right text-discord-text-normal">
                      ¥{entry.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gift section */}
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">ギフト</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Nitroをギフト</Button>
          <div className="flex items-center gap-2">
            <Input
              value={giftCode}
              onChange={(e) => setGiftCode(e.target.value)}
              placeholder="ギフトコードを入力"
              className="w-60"
            />
            <Button variant="secondary" disabled={!giftCode.trim()}>
              引き換え
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
