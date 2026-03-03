"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight } from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useCreateServer } from "@/shared/api/mutations/use-server-actions";
import { toCreateActionErrorText } from "@/shared/api/guild-channel-api-client";
import { buildGuildRoute } from "@/shared/config/routes";

const templates = [
  { id: "original", label: "オリジナル", emoji: "🛠️" },
  { id: "gaming", label: "ゲーム", emoji: "🎮" },
  { id: "school", label: "学校・クラブ", emoji: "📚" },
  { id: "study", label: "勉強グループ", emoji: "✏️" },
  { id: "friends", label: "フレンド", emoji: "👋" },
];

const purposes = [
  {
    id: "personal",
    label: "自分とフレンド用",
    description: "少数の人とやり取りする場所です",
  },
  {
    id: "community",
    label: "コミュニティ用",
    description: "大きなコミュニティを運営するための場所です",
  },
];

export function CreateServerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serverName, setServerName] = useState("のサーバー");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createServer = useCreateServer();
  const handleClose = () => {
    if (createServer.isPending) {
      return;
    }
    onClose();
  };

  const handleCreate = async () => {
    const normalizedName = serverName.trim();
    if (normalizedName.length === 0) return;

    setSubmitError(null);
    try {
      const createdServer = await createServer.mutateAsync({ name: normalizedName });
      onClose();
      router.push(buildGuildRoute(createdServer.id));
    } catch (error: unknown) {
      setSubmitError(toCreateActionErrorText(error, "サーバーの作成に失敗しました。"));
    }
  };

  return (
    <Modal open onClose={handleClose} className="max-w-[440px]">
      {step === 1 && (
        <>
          <div className="px-4 pt-6 pb-0 text-center">
            <h2 className="text-2xl font-bold text-discord-header-primary">サーバーを作成</h2>
            <p className="mt-2 text-sm text-discord-header-secondary">
              サーバーは、あなたとフレンドが交流する場所です。自分だけのサーバーを作って会話を始めましょう。
            </p>
          </div>
          <ModalBody>
            <div className="flex flex-col gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setStep(2)}
                  className="flex items-center justify-between rounded-lg border border-discord-border-subtle px-4 py-3 text-left transition-colors hover:bg-discord-bg-mod-hover"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{template.emoji}</span>
                    <span className="font-medium text-discord-text-normal">{template.label}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-discord-interactive-normal" />
                </button>
              ))}
            </div>
          </ModalBody>
          <ModalFooter className="flex-col items-center gap-2">
            <p className="text-xl font-bold text-discord-header-primary">
              すでに招待を持っていますか？
            </p>
            <Button variant="secondary" className="w-full" onClick={handleClose}>
              参加する
            </Button>
          </ModalFooter>
        </>
      )}

      {step === 2 && (
        <>
          <div className="px-4 pt-6 pb-0 text-center">
            <h2 className="text-2xl font-bold text-discord-header-primary">
              サーバーについて教えてください
            </h2>
            <p className="mt-2 text-sm text-discord-header-secondary">
              この情報は後から変更できます。
            </p>
          </div>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {purposes.map((purpose) => (
                <button
                  key={purpose.id}
                  onClick={() => setStep(3)}
                  className="flex items-center justify-between rounded-lg border border-discord-border-subtle px-4 py-4 text-left transition-colors hover:bg-discord-bg-mod-hover"
                >
                  <div>
                    <div className="font-medium text-discord-text-normal">{purpose.label}</div>
                    <div className="text-sm text-discord-text-muted">{purpose.description}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-discord-interactive-normal" />
                </button>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="link" onClick={() => setStep(1)}>
              戻る
            </Button>
          </ModalFooter>
        </>
      )}

      {step === 3 && (
        <>
          <div className="px-4 pt-6 pb-0 text-center">
            <h2 className="text-2xl font-bold text-discord-header-primary">
              サーバーをカスタマイズ
            </h2>
            <p className="mt-2 text-sm text-discord-header-secondary">
              サーバーの名前とアイコンを設定しましょう。後から変更できます。
            </p>
          </div>
          <ModalBody>
            <div className="flex flex-col items-center gap-4">
              <button className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed border-discord-interactive-normal text-discord-interactive-normal transition-colors hover:border-discord-interactive-hover hover:text-discord-interactive-hover">
                <Camera className="h-6 w-6" />
                <span className="text-[10px] font-bold uppercase">アップロード</span>
              </button>
              <Input
                label="サーバー名"
                value={serverName}
                onChange={(e) => {
                  setServerName(e.target.value);
                  if (submitError !== null) {
                    setSubmitError(null);
                  }
                }}
                error={submitError ?? undefined}
                fullWidth
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="link" onClick={() => setStep(2)}>
              戻る
            </Button>
            <Button
              disabled={!serverName.trim() || createServer.isPending}
              onClick={() => void handleCreate()}
            >
              作成
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
