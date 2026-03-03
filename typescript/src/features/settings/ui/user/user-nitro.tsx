"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

type BillingCycle = "monthly" | "yearly";
type Plan = "free" | "basic" | "nitro";

const currentPlan: Plan = "free";

const plans: {
  id: Plan;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ["25MBアップロード", "基本絵文字"],
  },
  {
    id: "basic",
    name: "Nitro Basic",
    monthlyPrice: 350,
    yearlyPrice: 3500,
    features: [
      "50MBアップロード",
      "カスタム絵文字（どこでも）",
      "プロフィールバナー",
      "カスタムタグ",
    ],
  },
  {
    id: "nitro",
    name: "Nitro",
    monthlyPrice: 1050,
    yearlyPrice: 10500,
    features: ["500MBアップロード", "全機能", "HD配信", "2ブースト付き", "アニメーションアバター"],
  },
];

export function UserNitro() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const yearlySavePercent = Math.round(
    ((plans[2].monthlyPrice * 12 - plans[2].yearlyPrice) / (plans[2].monthlyPrice * 12)) * 100,
  );

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">Nitro</h2>

      {/* Billing toggle */}
      <div className="mb-6 flex items-center justify-center gap-3">
        <button
          onClick={() => setBillingCycle("monthly")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            billingCycle === "monthly"
              ? "bg-discord-brand-blurple text-white"
              : "bg-discord-bg-secondary text-discord-text-muted hover:text-discord-text-normal",
          )}
        >
          月額
        </button>
        <button
          onClick={() => setBillingCycle("yearly")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            billingCycle === "yearly"
              ? "bg-discord-brand-blurple text-white"
              : "bg-discord-bg-secondary text-discord-text-muted hover:text-discord-text-normal",
          )}
        >
          年額
          <span className="rounded-full bg-discord-status-online px-2 py-0.5 text-[10px] font-bold text-white">
            {yearlySavePercent}% OFF
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const price =
            billingCycle === "monthly" ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12);

          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-lg border-2 bg-discord-bg-secondary p-5",
                isCurrent ? "border-discord-brand-blurple" : "border-transparent",
              )}
            >
              <h3 className="text-lg font-bold text-discord-header-primary">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-2xl font-bold text-discord-header-primary">
                  ¥{price.toLocaleString()}
                </span>
                {plan.monthlyPrice > 0 && (
                  <span className="text-sm text-discord-text-muted">/月</span>
                )}
              </div>
              {billingCycle === "yearly" && plan.yearlyPrice > 0 && (
                <p className="mt-1 text-xs text-discord-text-muted">
                  ¥{plan.yearlyPrice.toLocaleString()}/年
                </p>
              )}
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check size={14} className="text-discord-status-online" />
                    <span className="text-sm text-discord-text-normal">{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>
                    現在のプラン
                  </Button>
                ) : (
                  <Button className="w-full">
                    {plan.id === "free" ? "ダウングレード" : "アップグレード"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
