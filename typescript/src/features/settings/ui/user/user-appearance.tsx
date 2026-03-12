"use client";

import { useEffect, useRef, useState } from "react";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { useUpdateMyProfile } from "@/shared/api/mutations";
import { useMyProfile } from "@/shared/api/queries";
import { cn } from "@/shared/lib/cn";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { Button } from "@/shared/ui/button";

type Theme = "dark" | "light";

const themes: { id: Theme; label: string; bg: string; sidebar: string; text: string }[] = [
  { id: "dark", label: "ダーク", bg: "#313338", sidebar: "#2b2d31", text: "#dbdee1" },
  { id: "light", label: "ライト", bg: "#ffffff", sidebar: "#f2f3f5", text: "#313338" },
];

/**
 * ユーザー外観設定画面を表示する。
 */
export function UserAppearance() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentUserId = currentUser?.id ?? null;
  const {
    data: myProfile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useMyProfile(currentUserId);
  const updateMyProfile = useUpdateMyProfile(currentUserId);
  const [theme, setTheme] = useState<Theme>("dark");
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const hydratedUserIdRef = useRef<string | null>(null);
  const hasHydratedProfileRef = useRef(false);

  useEffect(() => {
    if (hydratedUserIdRef.current === currentUserId) {
      return;
    }

    hydratedUserIdRef.current = currentUserId;
    hasHydratedProfileRef.current = false;
    setTheme("dark");
    setSaveMessage(null);
  }, [currentUserId]);

  useEffect(() => {
    if (!myProfile || hasHydratedProfileRef.current) {
      return;
    }

    hasHydratedProfileRef.current = true;
    setTheme(myProfile.theme);
  }, [myProfile]);

  const persistedTheme = myProfile?.theme ?? "dark";
  const hasPendingChanges = theme !== persistedTheme;
  const canSave =
    isProfileLoading === false && hasPendingChanges && updateMyProfile.isPending === false;

  async function handleSave() {
    if (!hasPendingChanges) {
      return;
    }

    setSaveMessage(null);
    try {
      const updatedProfile = await updateMyProfile.mutateAsync({ theme });
      setTheme(updatedProfile.theme);
      setSaveMessage({
        type: "success",
        text: "外観設定を更新しました。",
      });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: toApiErrorText(error, "外観設定の更新に失敗しました。"),
      });
    }
  }

  function handleReset() {
    setTheme(persistedTheme);
    setSaveMessage(null);
  }

  return (
    <div className="pb-20">
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">外観</h2>

      {isProfileError && (
        <div className="mb-4 rounded bg-discord-bg-secondary px-3 py-2" role="alert">
          <p className="text-sm text-discord-status-dnd">
            {toApiErrorText(profileError, "外観設定の取得に失敗しました。")}
          </p>
          <Button
            className="mt-2"
            variant="link"
            size="sm"
            onClick={() => {
              void refetchProfile();
            }}
          >
            再試行
          </Button>
        </div>
      )}

      <section className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">テーマ</h3>
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          role="radiogroup"
          aria-label="テーマ"
        >
          {themes.map((t) => (
            <button
              type="button"
              key={t.id}
              role="radio"
              aria-checked={theme === t.id}
              onClick={() => {
                setTheme(t.id);
                setSaveMessage(null);
              }}
              className={cn(
                "flex flex-col overflow-hidden rounded-lg border-2 transition-colors",
                theme === t.id
                  ? "border-discord-brand-blurple"
                  : "border-transparent hover:border-discord-interactive-muted",
              )}
            >
              {/* Mini preview */}
              <div className="flex h-[60px]">
                <div className="w-1/3" style={{ backgroundColor: t.sidebar }} />
                <div className="flex-1 p-2" style={{ backgroundColor: t.bg }}>
                  <div
                    className="h-2 w-3/4 rounded"
                    style={{ backgroundColor: t.text, opacity: 0.3 }}
                  />
                  <div
                    className="mt-1 h-2 w-1/2 rounded"
                    style={{ backgroundColor: t.text, opacity: 0.2 }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 bg-discord-bg-secondary px-3 py-2">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    theme === t.id
                      ? "border-discord-brand-blurple"
                      : "border-discord-interactive-normal",
                  )}
                >
                  {theme === t.id && (
                    <span className="h-2.5 w-2.5 rounded-full bg-discord-brand-blurple" />
                  )}
                </span>
                <span className="text-sm font-medium text-discord-text-normal">{t.label}</span>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-discord-text-muted">
          保存すると保護画面全体に選択した light / dark が反映されます。
        </p>
      </section>

      {hasPendingChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-discord-bg-tertiary px-6 py-3 shadow-lg">
          <span className="text-sm text-discord-text-normal">保存されていない変更があります。</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="text-sm font-medium text-discord-text-link hover:underline"
            >
              リセット
            </button>
            <Button
              onClick={() => {
                void handleSave();
              }}
              disabled={!canSave}
            >
              {updateMyProfile.isPending ? "保存中..." : "変更を保存"}
            </Button>
          </div>
        </div>
      )}

      {saveMessage?.type === "success" && (
        <p role="status" className="text-sm text-discord-status-online">
          {saveMessage.text}
        </p>
      )}
      {saveMessage?.type === "error" && (
        <p role="alert" className="text-sm text-discord-status-dnd">
          {saveMessage.text}
        </p>
      )}
    </div>
  );
}
