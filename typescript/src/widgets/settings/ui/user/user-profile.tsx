"use client";

import { useState, useRef } from "react";
import { Avatar } from "@/shared/ui/avatar";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { useAuthStore } from "@/shared/model/stores/auth-store";
import { ImageCropModal } from "@/shared/ui/image-crop-modal";
import { cn } from "@/shared/lib/cn";

export function UserProfile() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [bio, setBio] = useState("");
  const [themeColor, setThemeColor] = useState("#5865F2");

  const [cropImage, setCropImage] = useState<{
    url: string;
    shape: "circle" | "rectangle";
    aspectRatio?: number;
    target: "avatar" | "banner";
  } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const handleFileSelect = (file: File, target: "avatar" | "banner") => {
    const url = URL.createObjectURL(file);
    setCropImage({
      url,
      shape: target === "avatar" ? "circle" : "rectangle",
      aspectRatio: target === "banner" ? 16 / 6 : undefined,
      target,
    });
  };

  const handleCrop = (croppedUrl: string) => {
    if (cropImage?.target === "avatar") {
      setAvatarUrl(croppedUrl);
    } else {
      setBannerUrl(croppedUrl);
    }
    setCropImage(null);
  };

  const BIO_MAX = 190;
  const BIO_WARN = 180;

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">プロフィール</h2>

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
                backgroundColor: bannerUrl ? undefined : themeColor,
                backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
              }}
            />
            <div className="relative px-4 pb-4">
              <div className="-mt-8 mb-2">
                <Avatar
                  src={avatarUrl ?? currentUser?.avatar ?? undefined}
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
          shape={cropImage.shape}
          aspectRatio={cropImage.aspectRatio}
          onCrop={handleCrop}
          onClose={() => setCropImage(null)}
        />
      )}
    </div>
  );
}
