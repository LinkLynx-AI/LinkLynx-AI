"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAPIClient } from "@/shared/api/api-client";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { resolveMyProfileMediaUrls, uploadMyProfileMedia } from "@/shared/api/my-profile-media";
import { syncMyProfileToAuthStore, syncMyProfileToSessionCaches } from "@/shared/api/my-profile-sync";
import { useUpdateMyProfile } from "@/shared/api/mutations";
import { useMyProfile } from "@/shared/api/queries";
import { cn } from "@/shared/lib/cn";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { ImageCropModal } from "@/shared/ui/image-crop-modal";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { getProfileImageSizeHint, validateProfileImageFile } from "../../lib/profile-image";

const BIO_MAX = 190;
const BIO_WARN = 180;

type SaveMessage = {
  type: "success" | "error";
  text: string;
} | null;

type ProfileMediaTarget = "avatar" | "banner";

type ProfileMediaDraft = {
  file: File;
  previewUrl: string;
};

type CropImageState = {
  file: File;
  url: string;
  shape: "circle" | "rectangle";
  aspectRatio?: number;
  target: ProfileMediaTarget;
};

function revokeDraft(draft: ProfileMediaDraft | null): void {
  if (draft !== null) {
    URL.revokeObjectURL(draft.previewUrl);
  }
}

/**
 * ユーザープロフィール設定フォームを表示する。
 */
export function UserProfile() {
  const queryClient = useQueryClient();
  const api = getAPIClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentUserId = currentUser?.id ?? null;
  const {
    data: myProfile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useMyProfile(currentUserId);
  const updateMyProfile = useUpdateMyProfile(currentUserId);

  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [bio, setBio] = useState("");
  const [themeColor, setThemeColor] = useState("#5865F2");
  const [saveMessage, setSaveMessage] = useState<SaveMessage>(null);
  const [selectionMessage, setSelectionMessage] = useState<SaveMessage>(null);
  const [cropImage, setCropImage] = useState<CropImageState | null>(null);
  const [avatarDraft, setAvatarDraft] = useState<ProfileMediaDraft | null>(null);
  const [bannerDraft, setBannerDraft] = useState<ProfileMediaDraft | null>(null);
  const [persistedAvatarUrl, setPersistedAvatarUrl] = useState<string | null>(currentUser?.avatar ?? null);
  const [persistedBannerUrl, setPersistedBannerUrl] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const hydratedUserIdRef = useRef<string | null>(null);
  const hasHydratedProfileRef = useRef(false);

  useEffect(() => {
    return () => {
      revokeDraft(avatarDraft);
    };
  }, [avatarDraft]);

  useEffect(() => {
    return () => {
      revokeDraft(bannerDraft);
    };
  }, [bannerDraft]);

  useEffect(() => {
    if (hydratedUserIdRef.current === currentUserId) {
      return;
    }

    hydratedUserIdRef.current = currentUserId;
    hasHydratedProfileRef.current = false;
    setDisplayName(currentUser?.displayName ?? "");
    setBio(currentUser?.customStatus ?? "");
    setPersistedAvatarUrl(currentUser?.avatar ?? null);
    setPersistedBannerUrl(null);
    setSelectionMessage(null);
    setSaveMessage(null);
    setThemeColor("#5865F2");
    revokeDraft(avatarDraft);
    revokeDraft(bannerDraft);
    setAvatarDraft(null);
    setBannerDraft(null);
  }, [avatarDraft, bannerDraft, currentUser?.avatar, currentUser?.customStatus, currentUser?.displayName, currentUserId]);

  useEffect(() => {
    if (!myProfile || hasHydratedProfileRef.current) {
      return;
    }
    hasHydratedProfileRef.current = true;
    setDisplayName(myProfile.displayName);
    setBio(myProfile.statusText ?? "");
  }, [myProfile]);

  useEffect(() => {
    if (myProfile === undefined) {
      return;
    }

    let cancelled = false;
    void resolveMyProfileMediaUrls(api, myProfile)
      .then((mediaUrls) => {
        if (cancelled) {
          return;
        }

        if (avatarDraft === null) {
          setPersistedAvatarUrl(mediaUrls.avatarUrl);
        }
        if (bannerDraft === null) {
          setPersistedBannerUrl(mediaUrls.bannerUrl);
        }

        if (currentUserId !== null) {
          syncMyProfileToSessionCaches(queryClient, currentUserId, myProfile, mediaUrls);
          return;
        }

        syncMyProfileToAuthStore(myProfile, mediaUrls);
      })
      .catch(() => {
        if (!cancelled && currentUserId === null) {
          syncMyProfileToAuthStore(myProfile);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, avatarDraft, bannerDraft, currentUserId, myProfile, queryClient]);

  const handleFileSelect = (file: File, target: ProfileMediaTarget) => {
    const validationError = validateProfileImageFile(target, file);
    if (validationError !== null) {
      setSelectionMessage({
        type: "error",
        text: validationError,
      });
      return;
    }

    const url = URL.createObjectURL(file);
    setSelectionMessage(null);
    setCropImage({
      file,
      url,
      shape: target === "avatar" ? "circle" : "rectangle",
      aspectRatio: target === "banner" ? 16 / 6 : undefined,
      target,
    });
  };

  const handleCrop = () => {
    if (cropImage === null) {
      return;
    }

    const nextDraft: ProfileMediaDraft = {
      file: cropImage.file,
      previewUrl: cropImage.url,
    };
    if (cropImage.target === "avatar") {
      revokeDraft(avatarDraft);
      setAvatarDraft(nextDraft);
    } else {
      revokeDraft(bannerDraft);
      setBannerDraft(nextDraft);
    }
    setSelectionMessage(null);
    setCropImage(null);
  };

  const handleCropClose = () => {
    if (cropImage !== null) {
      URL.revokeObjectURL(cropImage.url);
    }
    setCropImage(null);
  };

  const persistedDisplayName = myProfile?.displayName ?? currentUser?.displayName ?? "";
  const persistedStatusText = myProfile?.statusText ?? "";
  const normalizedPersistedDisplayName = persistedDisplayName.trim();
  const normalizedPersistedStatusText = persistedStatusText.trim();
  const normalizedDisplayName = displayName.trim();
  const normalizedBio = bio.trim();
  const hasPendingChanges =
    normalizedDisplayName !== normalizedPersistedDisplayName ||
    normalizedBio !== normalizedPersistedStatusText ||
    avatarDraft !== null ||
    bannerDraft !== null;
  const canSave =
    isProfileLoading === false && hasPendingChanges && updateMyProfile.isPending === false;

  const handleSave = async () => {
    const input: {
      displayName?: string;
      statusText?: string | null;
      avatarKey?: string | null;
      bannerKey?: string | null;
    } = {};

    if (normalizedDisplayName !== normalizedPersistedDisplayName) {
      input.displayName = normalizedDisplayName;
    }
    if (normalizedBio !== normalizedPersistedStatusText) {
      input.statusText = normalizedBio.length === 0 ? null : normalizedBio;
    }

    setSaveMessage(null);
    try {
      if (avatarDraft !== null) {
        input.avatarKey = await uploadMyProfileMedia(api, "avatar", avatarDraft.file);
      }
      if (bannerDraft !== null) {
        input.bannerKey = await uploadMyProfileMedia(api, "banner", bannerDraft.file);
      }
      if (Object.keys(input).length === 0) {
        return;
      }

      const updatedProfile = await updateMyProfile.mutateAsync(input);
      const mediaUrls = await resolveMyProfileMediaUrls(api, updatedProfile);

      if (currentUserId !== null) {
        syncMyProfileToSessionCaches(queryClient, currentUserId, updatedProfile, mediaUrls);
      } else {
        syncMyProfileToAuthStore(updatedProfile, mediaUrls);
      }

      setPersistedAvatarUrl(mediaUrls.avatarUrl);
      setPersistedBannerUrl(mediaUrls.bannerUrl);
      setDisplayName(updatedProfile.displayName);
      setBio(updatedProfile.statusText ?? "");
      revokeDraft(avatarDraft);
      revokeDraft(bannerDraft);
      setAvatarDraft(null);
      setBannerDraft(null);
      setSelectionMessage(null);
      setSaveMessage({
        type: "success",
        text: "プロフィールを更新しました。",
      });
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: toApiErrorText(error, "プロフィールの更新に失敗しました。"),
      });
    }
  };

  const avatarPreviewUrl = avatarDraft?.previewUrl ?? persistedAvatarUrl ?? currentUser?.avatar ?? null;
  const bannerPreviewUrl = bannerDraft?.previewUrl ?? persistedBannerUrl;

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">プロフィール</h2>

      {isProfileError && (
        <div className="mb-4 rounded bg-discord-bg-tertiary px-3 py-2" role="alert">
          <p className="text-sm text-discord-status-dnd">
            {toApiErrorText(profileError, "プロフィール情報の取得に失敗しました。")}
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

      <div className="flex gap-8">
        <div className="flex-1 space-y-6">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
              アバター
            </label>
            <Button variant="secondary" size="sm" onClick={() => avatarInputRef.current?.click()}>
              アバターを変更
            </Button>
            <p className="mt-2 text-xs text-discord-text-muted">
              {getProfileImageSizeHint("avatar")}
            </p>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file, "avatar");
                }
                e.target.value = "";
              }}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
              バナー
            </label>
            <Button variant="secondary" size="sm" onClick={() => bannerInputRef.current?.click()}>
              バナーを変更
            </Button>
            <p className="mt-2 text-xs text-discord-text-muted">
              {getProfileImageSizeHint("banner")}
            </p>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file, "banner");
                }
                e.target.value = "";
              }}
            />
          </div>

          <Input
            label="表示名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
          />

          <div>
            <Textarea
              label="自己紹介"
              value={bio}
              onChange={(e) => {
                if (e.target.value.length <= BIO_MAX) {
                  setBio(e.target.value);
                }
              }}
              placeholder="あなたについて教えてください"
              fullWidth
              rows={4}
            />
            <p
              className={cn(
                "mt-1 text-right text-xs",
                bio.length >= BIO_WARN ? "text-discord-brand-red" : "text-discord-text-muted",
              )}
            >
              {bio.length}/{BIO_MAX}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
              テーマカラー
            </label>
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded border-none bg-transparent"
            />
          </div>

          {selectionMessage?.type === "error" && (
            <div role="alert" className="rounded bg-discord-bg-tertiary px-3 py-2">
              <p className="text-sm text-discord-status-dnd">{selectionMessage.text}</p>
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={() => {
                void handleSave();
              }}
              disabled={!canSave}
            >
              {updateMyProfile.isPending ? "保存中..." : "変更を保存"}
            </Button>
            {saveMessage?.type === "success" && (
              <p role="status" className="text-sm text-discord-status-online">
                {saveMessage.text}
              </p>
            )}
            {saveMessage?.type === "error" && (
              <div role="alert" className="flex items-center gap-3">
                <p className="text-sm text-discord-status-dnd">{saveMessage.text}</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={updateMyProfile.isPending}
                >
                  再試行
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="w-[300px] shrink-0">
          <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
            プレビュー
          </h3>
          <div className="overflow-hidden rounded-lg bg-discord-bg-secondary">
            <div
              className="h-[60px] bg-cover bg-center"
              style={{
                backgroundColor: bannerPreviewUrl ? undefined : themeColor,
                backgroundImage: bannerPreviewUrl ? `url(${bannerPreviewUrl})` : undefined,
              }}
            />
            <div className="relative px-4 pb-4">
              <div className="-mt-8 mb-2">
                <Avatar
                  src={avatarPreviewUrl ?? undefined}
                  alt={displayName || "User"}
                  size={80}
                  className="rounded-full border-[6px] border-discord-bg-secondary"
                />
              </div>
              <p className="text-lg font-bold text-discord-header-primary">
                {displayName || "ユーザー"}
              </p>
              <p className="text-sm text-discord-text-muted">
                {currentUser?.username ?? "user#0000"}
              </p>
              {bio && (
                <>
                  <div className="my-3 h-px bg-discord-divider" />
                  <p className="text-sm text-discord-text-normal">{bio}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {cropImage && (
        <ImageCropModal
          imageUrl={cropImage.url}
          shape={cropImage.shape}
          aspectRatio={cropImage.aspectRatio}
          onCrop={handleCrop}
          onClose={handleCropClose}
        />
      )}
    </div>
  );
}
