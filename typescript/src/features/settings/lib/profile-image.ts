import type { ProfileMediaTarget } from "@/shared/api/api-client";

export const PROFILE_IMAGE_SIZE_LIMIT_BYTES = {
  avatar: 2 * 1024 * 1024,
  banner: 6 * 1024 * 1024,
} as const satisfies Record<ProfileMediaTarget, number>;

function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (Number.isInteger(megabytes)) {
    return `${megabytes}MB`;
  }

  return `${megabytes.toFixed(1)}MB`;
}

/**
 * プロフィール画像サイズ制約の案内文を返す。
 */
export function getProfileImageSizeHint(target: ProfileMediaTarget): string {
  const label = target === "avatar" ? "アバター" : "バナー";
  return `${label}画像は ${formatFileSize(PROFILE_IMAGE_SIZE_LIMIT_BYTES[target])} まで選択できます。`;
}

/**
 * プロフィール画像のサイズ制約を検証し、違反時は表示用メッセージを返す。
 */
export function validateProfileImageFile(
  target: ProfileMediaTarget,
  file: Pick<File, "size">,
): string | null {
  if (file.size <= PROFILE_IMAGE_SIZE_LIMIT_BYTES[target]) {
    return null;
  }

  const label = target === "avatar" ? "アバター" : "バナー";
  return `${label}画像は ${formatFileSize(PROFILE_IMAGE_SIZE_LIMIT_BYTES[target])} 以下のファイルを選択してください。`;
}
