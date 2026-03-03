"use client";

import { useState, useRef, useCallback } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { Check, Hash } from "lucide-react";

const TOTAL_STEPS = 4;

const RULES = [
  "他のメンバーに敬意を持って接しましょう。ハラスメント、差別、ヘイトスピーチは禁止です。",
  "スパムや自己宣伝（サーバーの招待、広告など）は許可なく行わないでください。",
  "適切なチャンネルを使用してください。各チャンネルのトピックに沿った会話をしましょう。",
  "NSFWコンテンツは指定されたチャンネルでのみ共有してください。",
  "Discordの利用規約とコミュニティガイドラインに従ってください。",
];

const INTEREST_OPTIONS = ["ゲーム", "プログラミング", "アート", "音楽", "アニメ"];
const EXPERIENCE_OPTIONS = ["初心者", "中級者", "上級者"];
const NOTIFICATION_OPTIONS = ["すべて", "メンションのみ", "なし"];

const SUGGESTED_CHANNELS = [
  { id: "1", name: "挨拶", description: "自己紹介をしましょう" },
  { id: "2", name: "雑談", description: "自由におしゃべり" },
  { id: "3", name: "お知らせ", description: "重要なアナウンス" },
  { id: "4", name: "ゲーム", description: "ゲームの話題はこちら" },
  { id: "5", name: "プログラミング", description: "コードについて語ろう" },
];

export function OnboardingModal({ onClose, serverId }: { onClose: () => void; serverId?: string }) {
  const [step, setStep] = useState(0);
  const [rulesScrolledToBottom, setRulesScrolledToBottom] = useState(false);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [experience, setExperience] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const rulesRef = useRef<HTMLDivElement>(null);

  const handleRulesScroll = useCallback(() => {
    const el = rulesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
    if (atBottom) setRulesScrolledToBottom(true);
  }, []);

  const toggleInterest = (option: string) => {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <Modal open onClose={onClose} className="max-w-[520px]">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 px-4 pt-4">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              i === step
                ? "bg-discord-brand-blurple"
                : i < step
                  ? "bg-discord-brand-blurple/50"
                  : "bg-discord-bg-tertiary",
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="px-6 py-6">
        {step === 0 && <StepWelcome serverId={serverId} />}
        {step === 1 && (
          <StepRules
            rulesRef={rulesRef}
            onScroll={handleRulesScroll}
            scrolledToBottom={rulesScrolledToBottom}
          />
        )}
        {step === 2 && (
          <StepAboutYou
            interests={interests}
            experience={experience}
            notification={notification}
            onToggleInterest={toggleInterest}
            onSetExperience={setExperience}
            onSetNotification={setNotification}
          />
        )}
        {step === 3 && <StepComplete />}
      </div>

      <ModalFooter>
        {step > 0 && step < TOTAL_STEPS - 1 && (
          <Button variant="link" onClick={back}>
            戻る
          </Button>
        )}
        {step === 0 && <Button onClick={next}>始める</Button>}
        {step === 1 && (
          <Button onClick={next} disabled={!rulesScrolledToBottom}>
            同意する
          </Button>
        )}
        {step === 2 && <Button onClick={next}>次へ</Button>}
        {step === 3 && <Button onClick={onClose}>完了</Button>}
      </ModalFooter>
    </Modal>
  );
}

function StepWelcome({ serverId }: { serverId?: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-discord-brand-blurple text-2xl font-bold text-white">
        {serverId ? serverId.charAt(0).toUpperCase() : "S"}
      </div>
      <h2 className="text-2xl font-bold text-discord-header-primary">サーバーへようこそ!</h2>
      <p className="mt-2 text-sm text-discord-text-muted">
        このサーバーに参加するための簡単なセットアップを行います。
      </p>
    </div>
  );
}

function StepRules({
  rulesRef,
  onScroll,
  scrolledToBottom,
}: {
  rulesRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  scrolledToBottom: boolean;
}) {
  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-discord-header-primary">サーバールール</h2>
      <p className="mb-4 text-sm text-discord-text-muted">
        このサーバーを利用するには、以下のルールに同意してください。
      </p>
      <div
        ref={rulesRef}
        onScroll={onScroll}
        className="max-h-[240px] space-y-3 overflow-y-auto pr-2"
      >
        {RULES.map((rule, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-discord-brand-blurple text-xs font-bold text-white">
              {i + 1}
            </div>
            <p className="text-sm leading-relaxed text-discord-text-normal">{rule}</p>
          </div>
        ))}
      </div>
      {!scrolledToBottom && (
        <p className="mt-3 text-center text-xs text-discord-text-muted">
          すべてのルールを読むには下にスクロールしてください
        </p>
      )}
    </div>
  );
}

function StepAboutYou({
  interests,
  experience,
  notification,
  onToggleInterest,
  onSetExperience,
  onSetNotification,
}: {
  interests: Set<string>;
  experience: string | null;
  notification: string | null;
  onToggleInterest: (option: string) => void;
  onSetExperience: (option: string) => void;
  onSetNotification: (option: string) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-discord-header-primary">
        あなたについて教えてください
      </h2>

      {/* Interests */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
          どんなことに興味がありますか?
        </div>
        <div className="space-y-2">
          {INTEREST_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-discord-bg-mod-hover"
            >
              <Checkbox checked={interests.has(option)} onChange={() => onToggleInterest(option)} />
              <span className="text-sm text-discord-text-normal">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Experience */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
          経験レベルは?
        </div>
        <div className="space-y-2">
          {EXPERIENCE_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-discord-bg-mod-hover"
            >
              <Checkbox checked={experience === option} onChange={() => onSetExperience(option)} />
              <span className="text-sm text-discord-text-normal">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notification preferences */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
          通知設定
        </div>
        <div className="space-y-2">
          {NOTIFICATION_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-discord-bg-mod-hover"
            >
              <Checkbox
                checked={notification === option}
                onChange={() => onSetNotification(option)}
              />
              <span className="text-sm text-discord-text-normal">{option}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepComplete() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-discord-status-online text-3xl">
        <Check className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-discord-header-primary">完了!</h2>
      <p className="mt-2 text-sm text-discord-text-muted">
        セットアップが完了しました。以下のチャンネルがおすすめです。
      </p>
      <div className="mt-4 space-y-2">
        {SUGGESTED_CHANNELS.map((channel) => (
          <div
            key={channel.id}
            className="flex items-center gap-2 rounded-md bg-discord-bg-secondary px-3 py-2 text-left"
          >
            <Hash className="h-4 w-4 shrink-0 text-discord-channel-icon" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-discord-header-primary">{channel.name}</div>
              <div className="text-xs text-discord-text-muted">{channel.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
