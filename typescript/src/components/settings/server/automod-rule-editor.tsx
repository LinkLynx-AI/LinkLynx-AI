"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";

export interface AutoModAction {
  type: "block_message" | "send_alert_message" | "timeout";
  metadata?: {
    channelId?: string;
    durationSeconds?: number;
  };
}

export interface AutoModRule {
  id: string;
  name: string;
  eventType: "message_send";
  triggerType: "keyword" | "regex" | "mention_spam" | "harmful_link";
  triggerMetadata: {
    keywordFilter?: string[];
    regexPatterns?: string[];
    mentionTotalLimit?: number;
  };
  actions: AutoModAction[];
  exemptRoles?: string[];
  exemptChannels?: string[];
  enabled: boolean;
}

const triggerTypeOptions = [
  { value: "keyword", label: "キーワードフィルタ" },
  { value: "regex", label: "正規表現" },
  { value: "mention_spam", label: "メンションスパム" },
  { value: "harmful_link", label: "有害なリンク" },
];

const alertChannelOptions = [
  { value: "ch-mod", label: "#mod-log" },
  { value: "ch-admin", label: "#admin" },
  { value: "ch-general", label: "#general" },
];

const timeoutDurationOptions = [
  { value: "60", label: "1分" },
  { value: "300", label: "5分" },
  { value: "600", label: "10分" },
  { value: "3600", label: "1時間" },
  { value: "86400", label: "24時間" },
];

const roleOptions = [
  { value: "role-mod", label: "Moderator" },
  { value: "role-admin", label: "Admin" },
  { value: "role-vip", label: "VIP" },
];

const channelExemptOptions = [
  { value: "ch-bot", label: "#bot-commands" },
  { value: "ch-mod", label: "#mod-log" },
  { value: "ch-admin", label: "#admin" },
];

export function AutomodRuleEditor({
  rule,
  onSave,
  onCancel,
}: {
  rule?: AutoModRule;
  onSave: (rule: AutoModRule) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [triggerType, setTriggerType] = useState<AutoModRule["triggerType"]>(
    rule?.triggerType ?? "keyword"
  );
  const [keywords, setKeywords] = useState(
    rule?.triggerMetadata.keywordFilter?.join("\n") ?? ""
  );
  const [regexPatterns, setRegexPatterns] = useState(
    rule?.triggerMetadata.regexPatterns?.join("\n") ?? ""
  );
  const [mentionLimit, setMentionLimit] = useState(
    rule?.triggerMetadata.mentionTotalLimit ?? 5
  );
  const [blockMessage, setBlockMessage] = useState(
    rule?.actions.some((a) => a.type === "block_message") ?? true
  );
  const [sendAlert, setSendAlert] = useState(
    rule?.actions.some((a) => a.type === "send_alert_message") ?? false
  );
  const [alertChannel, setAlertChannel] = useState(
    rule?.actions.find((a) => a.type === "send_alert_message")?.metadata
      ?.channelId ?? "ch-mod"
  );
  const [timeout, setTimeout_] = useState(
    rule?.actions.some((a) => a.type === "timeout") ?? false
  );
  const [timeoutDuration, setTimeoutDuration] = useState(
    String(
      rule?.actions.find((a) => a.type === "timeout")?.metadata
        ?.durationSeconds ?? 60
    )
  );
  const [exemptRole, setExemptRole] = useState(rule?.exemptRoles?.[0] ?? "");
  const [exemptChannel, setExemptChannel] = useState(
    rule?.exemptChannels?.[0] ?? ""
  );
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);

  const handleSave = () => {
    const actions: AutoModAction[] = [];
    if (blockMessage) actions.push({ type: "block_message" });
    if (sendAlert)
      actions.push({
        type: "send_alert_message",
        metadata: { channelId: alertChannel },
      });
    if (timeout)
      actions.push({
        type: "timeout",
        metadata: { durationSeconds: Number(timeoutDuration) },
      });

    const triggerMetadata: AutoModRule["triggerMetadata"] = {};
    if (triggerType === "keyword") {
      triggerMetadata.keywordFilter = keywords
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean);
    } else if (triggerType === "regex") {
      triggerMetadata.regexPatterns = regexPatterns
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean);
    } else if (triggerType === "mention_spam") {
      triggerMetadata.mentionTotalLimit = mentionLimit;
    }

    const newRule: AutoModRule = {
      id: rule?.id ?? `rule-${Date.now()}`,
      name,
      eventType: "message_send",
      triggerType,
      triggerMetadata,
      actions,
      exemptRoles: exemptRole ? [exemptRole] : [],
      exemptChannels: exemptChannel ? [exemptChannel] : [],
      enabled,
    };
    onSave(newRule);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-discord-header-primary">
        {rule ? "ルールを編集" : "ルールを作成"}
      </h3>

      <Input
        label="ルール名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ルール名を入力..."
        fullWidth
      />

      <div>
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          トリガータイプ
        </label>
        <Select
          options={triggerTypeOptions}
          value={triggerType}
          onChange={(v) => setTriggerType(v as AutoModRule["triggerType"])}
          className="w-full max-w-[320px]"
        />
      </div>

      {/* Trigger-specific fields */}
      {triggerType === "keyword" && (
        <div>
          <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
            キーワード
          </label>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="ブロックするキーワードを1行ずつ入力..."
            rows={4}
            className="w-full max-w-[480px] rounded-[3px] bg-discord-input-bg p-3 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple resize-y"
          />
        </div>
      )}

      {triggerType === "regex" && (
        <div>
          <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
            正規表現パターン
          </label>
          <textarea
            value={regexPatterns}
            onChange={(e) => setRegexPatterns(e.target.value)}
            placeholder="正規表現パターンを1行ずつ入力..."
            rows={4}
            className="w-full max-w-[480px] rounded-[3px] bg-discord-input-bg p-3 text-sm text-discord-text-normal placeholder:text-discord-text-muted outline-none focus:outline-2 focus:outline-discord-brand-blurple resize-y font-mono"
          />
        </div>
      )}

      {triggerType === "mention_spam" && (
        <div>
          <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
            メンション上限: {mentionLimit}
          </label>
          <input
            type="range"
            min={1}
            max={50}
            value={mentionLimit}
            onChange={(e) => setMentionLimit(Number(e.target.value))}
            className="w-full max-w-[320px] accent-discord-brand-blurple"
          />
          <div className="flex max-w-[320px] justify-between text-xs text-discord-text-muted">
            <span>1</span>
            <span>50</span>
          </div>
        </div>
      )}

      {triggerType === "harmful_link" && (
        <p className="text-sm text-discord-text-muted">
          有害なリンクは自動的に検出されます。追加の設定は不要です。
        </p>
      )}

      {/* Actions */}
      <section>
        <h4 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          アクション
        </h4>
        <div className="max-w-[480px] space-y-3">
          <div className="flex items-center justify-between rounded bg-discord-bg-secondary px-3 py-2">
            <span className="text-sm text-discord-text-normal">
              メッセージをブロック
            </span>
            <Toggle checked={blockMessage} onChange={setBlockMessage} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded bg-discord-bg-secondary px-3 py-2">
              <span className="text-sm text-discord-text-normal">
                アラートを送信
              </span>
              <Toggle checked={sendAlert} onChange={setSendAlert} />
            </div>
            {sendAlert && (
              <div className="ml-4">
                <Select
                  options={alertChannelOptions}
                  value={alertChannel}
                  onChange={setAlertChannel}
                  className="w-full max-w-[280px]"
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded bg-discord-bg-secondary px-3 py-2">
              <span className="text-sm text-discord-text-normal">
                タイムアウト
              </span>
              <Toggle checked={timeout} onChange={setTimeout_} />
            </div>
            {timeout && (
              <div className="ml-4">
                <Select
                  options={timeoutDurationOptions}
                  value={timeoutDuration}
                  onChange={setTimeoutDuration}
                  className="w-full max-w-[280px]"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Exemptions */}
      <section>
        <h4 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          除外設定
        </h4>
        <div className="max-w-[480px] space-y-4">
          <div>
            <label className="mb-2 block text-xs text-discord-text-muted">
              除外ロール
            </label>
            <Select
              options={[{ value: "", label: "なし" }, ...roleOptions]}
              value={exemptRole}
              onChange={setExemptRole}
              className="w-full max-w-[320px]"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs text-discord-text-muted">
              除外チャンネル
            </label>
            <Select
              options={[
                { value: "", label: "なし" },
                ...channelExemptOptions,
              ]}
              value={exemptChannel}
              onChange={setExemptChannel}
              className="w-full max-w-[320px]"
            />
          </div>
        </div>
      </section>

      {/* Enable/Disable */}
      <div className="flex items-center justify-between max-w-[480px] rounded bg-discord-bg-secondary px-3 py-3">
        <span className="text-sm font-medium text-discord-text-normal">
          ルールを有効にする
        </span>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={!name.trim()}>
          {rule ? "保存" : "作成"}
        </Button>
        <Button variant="link" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}
