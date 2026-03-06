"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdateMyProfileInput } from "@/shared/api/api-client";
import { toApiErrorText } from "@/shared/api/guild-channel-api-client";
import { useUpdateMyProfile } from "@/shared/api/mutations";
import { useMyProfile, useStorageObjectUrl } from "@/shared/api/queries";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { ImageCropModal, type CroppedImageResult } from "@/shared/ui/image-crop-modal";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { cn } from "@/shared/lib/cn";
import {
  cleanupUploadedProfileMediaKeys,
  uploadProfileMediaFile,
} from "@/features/settings/model/profile-media";

const BIO_MAX = 190;
const BIO_WARN = 180;

type CropImageState = {
  file: File;
  url: string;
  shape: "circle" | "rectangle";
  aspectRatio?: number;
  target: "avatar" | "banner";
};

function revokeObjectUrlIfNeeded(value: string | null): void {
  if (value !== null && value.startsWith("blob:")) {
    URL.revokeObjectURL(value);
  }
}

function toProfileSaveErrorText(error: unknown): string {
  if (error instanceof Error && error.name === "FirebaseError") {
    return "プロフィール画像のアップロードに失敗しました。";
  }

  return toApiErrorText(error, "プロフィールの更新に失敗しました。");
}

export function UserProfile() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const setCustomStatus = useAuthStore((s) => s.setCustomStatus);
  const currentUserId = currentUser?.id ?? null;
  const {
    data: myProfile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useMyProfile(currentUserId);
  const updateMyProfile = useUpdateMyProfile(currentUserId);
  const { data: resolvedAvatarUrl } = useStorageObjectUrl(myProfile?.avatarKey ?? null);
  const { data: resolvedBannerUrl } = useStorageObjectUrl(myProfile?.bannerKey ?? null);

  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [bio, setBio] = useState("");
  const [themeColor, setThemeColor] = useState("#5865F2");
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [cropImage, setCropImage] = useState<CropImageState | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const hydratedUserIdRef = useRef<string | null>(null);
  const hasHydratedProfileRef = useRef(false);
  const avatarPreviewUrlRef = useRef<string | null>(null);
  const bannerPreviewUrlRef = useRef<string | null>(null);
  const cropImageUrlRef = useRef<string | null>(null);

  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);

  const replaceAvatarPreviewUrl = useCallback((nextValue: string | null) => {
    setAvatarPreviewUrl((currentValue) => {
      if (currentValue !== nextValue) {
        revokeObjectUrlIfNeeded(currentValue);
      }
      return nextValue;
    });
  }, []);

  const replaceBannerPreviewUrl = useCallback((nextValue: string | null) => {
    setBannerPreviewUrl((currentValue) => {
      if (currentValue !== nextValue) {
        revokeObjectUrlIfNeeded(currentValue);
      }
      return nextValue;
    });
  }, []);

  useEffect(() => {
    avatarPreviewUrlRef.current = avatarPreviewUrl;
  }, [avatarPreviewUrl]);

  useEffect(() => {
    bannerPreviewUrlRef.current = bannerPreviewUrl;
  }, [bannerPreviewUrl]);

  useEffect(() => {
    cropImageUrlRef.current = cropImage?.url ?? null;
  }, [cropImage]);

  useEffect(
    () => () => {
      revokeObjectUrlIfNeeded(avatarPreviewUrlRef.current);
      revokeObjectUrlIfNeeded(bannerPreviewUrlRef.current);
      revokeObjectUrlIfNeeded(cropImageUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (hydratedUserIdRef.current === currentUserId) {
      return;
    }
    hydratedUserIdRef.current = currentUserId;
    hasHydratedProfileRef.current = false;
    setDisplayName(currentUser?.displayName ?? "");
    setBio(currentUser?.customStatus ?? "");
    setSaveMessage(null);
    setPendingAvatarFile(null);
    setPendingBannerFile(null);
    replaceAvatarPreviewUrl(currentUser?.avatar ?? null);
    replaceBannerPreviewUrl(null);
    setCropImage((currentCropImage) => {
      if (currentCropImage !== null) {
        revokeObjectUrlIfNeeded(currentCropImage.url);
      }
      return null;
    });
  }, [
    currentUser?.avatar,
    currentUser?.customStatus,
    currentUser?.displayName,
    currentUserId,
    replaceAvatarPreviewUrl,
    replaceBannerPreviewUrl,
  ]);

  useEffect(() => {
    if (!myProfile || hasHydratedProfileRef.current) {
      return;
    }
    hasHydratedProfileRef.current = true;
    setDisplayName(myProfile.displayName);
    setBio(myProfile.statusText ?? "");
  }, [myProfile]);

  useEffect(() => {
    const currentAvatar = currentUser?.avatar ?? null;

    if (pendingAvatarFile !== null) {
      return;
    }
    if (myProfile?.avatarKey !== null && resolvedAvatarUrl === undefined) {
      if (currentAvatar !== null) {
        replaceAvatarPreviewUrl(currentAvatar);
      }
      return;
    }

    replaceAvatarPreviewUrl(resolvedAvatarUrl ?? currentAvatar);
  }, [
    currentUser?.avatar,
    myProfile?.avatarKey,
    pendingAvatarFile,
    replaceAvatarPreviewUrl,
    resolvedAvatarUrl,
  ]);

  useEffect(() => {
    if (pendingBannerFile !== null) {
      return;
    }
    if (myProfile?.bannerKey !== null && resolvedBannerUrl === undefined) {
      return;
    }

    replaceBannerPreviewUrl(resolvedBannerUrl ?? null);
  }, [myProfile?.bannerKey, pendingBannerFile, replaceBannerPreviewUrl, resolvedBannerUrl]);

  const handleFileSelect = (file: File, target: "avatar" | "banner") => {
    const url = URL.createObjectURL(file);
    if (cropImage !== null) {
      revokeObjectUrlIfNeeded(cropImage.url);
    }
    setCropImage({
      file,
      url,
      shape: target === "avatar" ? "circle" : "rectangle",
      aspectRatio: target === "banner" ? 16 / 6 : undefined,
      target,
    });
  };

  const handleCrop = (croppedImage: CroppedImageResult) => {
    if (cropImage === null) {
      return;
    }

    if (cropImage?.target === "avatar") {
      setPendingAvatarFile(croppedImage.file);
      replaceAvatarPreviewUrl(croppedImage.url);
    } else {
      setPendingBannerFile(croppedImage.file);
      replaceBannerPreviewUrl(croppedImage.url);
    }
    setSaveMessage(null);
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
    pendingAvatarFile !== null ||
    pendingBannerFile !== null;
  const canSave =
    isProfileLoading === false && hasPendingChanges && updateMyProfile.isPending === false;

  const previewAvatarUrl = avatarPreviewUrl ?? resolvedAvatarUrl ?? currentUser?.avatar ?? null;
  const previewBannerUrl = bannerPreviewUrl ?? resolvedBannerUrl ?? null;

  const handleSave = async () => {
    if (currentUserId === null) {
      setSaveMessage({
        type: "error",
        text: "ログイン状態を確認してから再試行してください。",
      });
      return;
    }

    const input: UpdateMyProfileInput = {};
    const uploadedObjectKeys: string[] = [];

    if (normalizedDisplayName !== normalizedPersistedDisplayName) {
      input.displayName = normalizedDisplayName;
    }
    if (normalizedBio !== normalizedPersistedStatusText) {
      input.statusText = normalizedBio.length === 0 ? null : normalizedBio;
    }

    setSaveMessage(null);
    try {
      if (pendingAvatarFile !== null) {
        const avatarKey = await uploadProfileMediaFile(currentUserId, "avatar", pendingAvatarFile);
        uploadedObjectKeys.push(avatarKey);
        input.avatarKey = avatarKey;
      }
      if (pendingBannerFile !== null) {
        const bannerKey = await uploadProfileMediaFile(currentUserId, "banner", pendingBannerFile);
        uploadedObjectKeys.push(bannerKey);
        input.bannerKey = bannerKey;
      }
      if (Object.keys(input).length === 0) {
        return;
      }

      const updatedProfile = await updateMyProfile.mutateAsync(input);
      if (currentUser !== null) {
        setCurrentUser({
          ...currentUser,
          displayName: updatedProfile.displayName,
          customStatus: updatedProfile.statusText,
          avatar:
            input.avatarKey !== undefined
              ? (avatarPreviewUrl ?? currentUser.avatar ?? null)
              : currentUser.avatar,
        });
      }
      setCustomStatus(updatedProfile.statusText);
      setDisplayName(updatedProfile.displayName);
      setBio(updatedProfile.statusText ?? "");
      setPendingAvatarFile(null);
      setPendingBannerFile(null);
      setSaveMessage({
        type: "success",
        text: "プロフィールを更新しました。",
      });
    } catch (error) {
      if (uploadedObjectKeys.length > 0) {
        await cleanupUploadedProfileMediaKeys(uploadedObjectKeys);
      }
      setSaveMessage({
        type: "error",
        text: toProfileSaveErrorText(error),
      });
    }
  };

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
        {/* Form */}
        <div className="flex-1 space-y-6">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
              アバター
            </label>
            <Button variant="secondary" size="sm" onClick={() => avatarInputRef.current?.click()}>
              アバターを変更
            </Button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              aria-label="アバター画像ファイル"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file, "avatar");
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
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              aria-label="バナー画像ファイル"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file, "banner");
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
                if (e.target.value.length <= BIO_MAX) setBio(e.target.value);
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

        {/* Preview card */}
        <div className="w-[300px] shrink-0">
          <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
            プレビュー
          </h3>
          <div className="overflow-hidden rounded-lg bg-discord-bg-secondary">
            <div
              className="h-[60px] bg-cover bg-center"
              style={{
                backgroundColor: previewBannerUrl ? undefined : themeColor,
                backgroundImage: previewBannerUrl ? `url(${previewBannerUrl})` : undefined,
              }}
            />
            <div className="relative px-4 pb-4">
              <div className="-mt-8 mb-2">
                <Avatar
                  src={previewAvatarUrl ?? undefined}
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

      {/* Image crop modal */}
      {cropImage && (
        <ImageCropModal
          imageUrl={cropImage.url}
          sourceFile={cropImage.file}
          shape={cropImage.shape}
          aspectRatio={cropImage.aspectRatio}
          onCrop={handleCrop}
          onClose={() => {
            revokeObjectUrlIfNeeded(cropImage.url);
            setCropImage(null);
          }}
        />
      )}
    </div>
  );
}
