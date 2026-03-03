"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { Toggle } from "@/shared/ui/legacy/toggle";
import { Button } from "@/shared/ui/legacy/button";
import { AutomodRuleEditor, type AutoModRule } from "./automod-rule-editor";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";

const initialRules: AutoModRule[] = [
  {
    id: "rule-1",
    name: "スパムリンクブロック",
    eventType: "message_send",
    triggerType: "harmful_link",
    triggerMetadata: {},
    actions: [{ type: "block_message" }],
    exemptRoles: ["role-admin"],
    exemptChannels: [],
    enabled: true,
  },
  {
    id: "rule-2",
    name: "メンションスパム防止",
    eventType: "message_send",
    triggerType: "mention_spam",
    triggerMetadata: { mentionTotalLimit: 10 },
    actions: [{ type: "block_message" }, { type: "timeout", metadata: { durationSeconds: 300 } }],
    exemptRoles: [],
    exemptChannels: [],
    enabled: true,
  },
];

const triggerTypeLabels: Record<AutoModRule["triggerType"], string> = {
  keyword: "キーワード",
  regex: "正規表現",
  mention_spam: "メンションスパム",
  harmful_link: "有害なリンク",
};

export function ServerAutomod({ serverId }: { serverId: string }) {
  const [rules, setRules] = useState<AutoModRule[]>(initialRules);
  const [editingRule, setEditingRule] = useState<AutoModRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [blockedWords, setBlockedWords] = useState("spam\nbad-word\nscam");
  const [mentionLimit, setMentionLimit] = useState(5);
  const [duplicateDetection, setDuplicateDetection] = useState(true);
  const [hateSpeech, setHateSpeech] = useState(true);
  const [sexualContent, setSexualContent] = useState(true);
  const [violentContent, setViolentContent] = useState(false);
  const [action, setAction] = useState<"block" | "alert" | "timeout">("block");

  const handleSaveRule = (rule: AutoModRule) => {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === rule.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = rule;
        return next;
      }
      return [...prev, rule];
    });
    setEditingRule(null);
    setCreating(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)));
  };

  if (creating || editingRule) {
    return (
      <div>
        <h2 className="mb-5 text-xl font-bold text-discord-header-primary">AutoMod</h2>
        <AutomodRuleEditor
          rule={editingRule ?? undefined}
          onSave={handleSaveRule}
          onCancel={() => {
            setEditingRule(null);
            setCreating(false);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">AutoMod</h2>

      {/* Custom Rules */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase text-discord-header-secondary">
            カスタムルール
          </h3>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" />
            ルールを作成
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg bg-discord-bg-secondary py-8 text-center">
            <Shield className="mb-2 h-8 w-8 text-discord-interactive-muted" />
            <p className="text-sm text-discord-text-muted">カスタムルールはまだありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 rounded-lg bg-discord-bg-secondary px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-discord-text-normal truncate">
                      {rule.name}
                    </p>
                    <span className="shrink-0 rounded bg-discord-bg-tertiary px-1.5 py-0.5 text-[10px] text-discord-text-muted">
                      {triggerTypeLabels[rule.triggerType]}
                    </span>
                  </div>
                </div>
                <Toggle checked={rule.enabled} onChange={() => handleToggleRule(rule.id)} />
                <button
                  onClick={() => setEditingRule(rule)}
                  className="rounded p-1 text-discord-interactive-normal hover:text-discord-interactive-hover transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="rounded p-1 text-discord-interactive-normal hover:text-discord-brand-red transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Keyword Filter */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-bold uppercase text-discord-header-secondary">
          キーワードフィルタ
        </h3>
        <textarea
          value={blockedWords}
          onChange={(e) => setBlockedWords(e.target.value)}
          placeholder="ブロックする単語を1行ずつ入力..."
          rows={5}
          className="w-full max-w-[480px] rounded-[3px] bg-discord-input-bg p-3 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple resize-y"
        />
        <p className="mt-1 text-xs text-discord-text-muted">
          1行につき1つのキーワードを入力してください
        </p>
      </section>

      {/* Spam Detection */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-bold uppercase text-discord-header-secondary">
          スパム検出
        </h3>
        <div className="mb-4">
          <label className="mb-2 block text-sm text-discord-text-normal">
            メンション上限: {mentionLimit}
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={mentionLimit}
            onChange={(e) => setMentionLimit(Number(e.target.value))}
            className="w-full max-w-[320px] accent-discord-brand-blurple"
          />
          <div className="flex justify-between max-w-[320px] text-xs text-discord-text-muted">
            <span>1</span>
            <span>20</span>
          </div>
        </div>
        <div className="flex items-center justify-between max-w-[480px] border-b border-discord-divider py-3">
          <span className="text-sm text-discord-text-normal">重複メッセージ検出</span>
          <Toggle checked={duplicateDetection} onChange={setDuplicateDetection} />
        </div>
      </section>

      {/* Content Filter */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-bold uppercase text-discord-header-secondary">
          コンテンツフィルタ
        </h3>
        <div className="max-w-[480px]">
          <div className="flex items-center justify-between border-b border-discord-divider py-3">
            <span className="text-sm text-discord-text-normal">ヘイトスピーチ</span>
            <Toggle checked={hateSpeech} onChange={setHateSpeech} />
          </div>
          <div className="flex items-center justify-between border-b border-discord-divider py-3">
            <span className="text-sm text-discord-text-normal">性的コンテンツ</span>
            <Toggle checked={sexualContent} onChange={setSexualContent} />
          </div>
          <div className="flex items-center justify-between border-b border-discord-divider py-3">
            <span className="text-sm text-discord-text-normal">暴力的コンテンツ</span>
            <Toggle checked={violentContent} onChange={setViolentContent} />
          </div>
        </div>
      </section>

      {/* Action Settings */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-bold uppercase text-discord-header-secondary">
          アクション設定
        </h3>
        <div className="flex flex-col gap-2 max-w-[480px]">
          {[
            { value: "block" as const, label: "ブロック" },
            { value: "alert" as const, label: "アラート" },
            { value: "timeout" as const, label: "タイムアウト" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-center gap-3 rounded px-3 py-2 cursor-pointer transition-colors",
                action === opt.value ? "bg-discord-bg-mod-active" : "hover:bg-discord-bg-mod-hover",
              )}
            >
              <input
                type="radio"
                name="automod-action"
                value={opt.value}
                checked={action === opt.value}
                onChange={() => setAction(opt.value)}
                className="accent-discord-brand-blurple"
              />
              <span className="text-sm text-discord-text-normal">{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      <Button>変更を保存</Button>
    </div>
  );
}
