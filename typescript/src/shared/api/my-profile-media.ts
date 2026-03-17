import type { APIClient, MyProfile, ProfileMediaTarget } from "./api-client";

export type ResolvedMyProfileMediaUrls = {
  avatarUrl: string | null;
  bannerUrl: string | null;
};

type ProfileMediaApi = Pick<
  APIClient,
  "createMyProfileMediaUploadUrl" | "getMyProfileMediaDownloadUrl"
>;

function resolveProfileMediaContentType(file: File): string {
  const trimmedType = file.type.trim();
  if (trimmedType.length > 0) {
    return trimmedType;
  }

  const extension = file.name.trim().split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

function buildUploadFilename(target: ProfileMediaTarget, file: File): string {
  const trimmed = file.name.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  return `${target}.bin`;
}

/**
 * プロフィール画像を presigned URL へアップロードし object key を返す。
 */
export async function uploadMyProfileMedia(
  api: ProfileMediaApi,
  target: ProfileMediaTarget,
  file: File,
): Promise<string> {
  const contentType = resolveProfileMediaContentType(file);
  const upload = await api.createMyProfileMediaUploadUrl({
    target,
    filename: buildUploadFilename(target, file),
    contentType,
    sizeBytes: file.size,
  });
  const headers = new Headers(upload.requiredHeaders);
  if (!headers.has("content-type")) {
    headers.set("content-type", contentType);
  }

  const response = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error("プロフィール画像のアップロードに失敗しました。");
  }

  return upload.objectKey;
}

async function resolveMediaUrl(
  api: Pick<APIClient, "getMyProfileMediaDownloadUrl">,
  target: ProfileMediaTarget,
  expectedObjectKey: string | null,
): Promise<string | null> {
  if (expectedObjectKey === null) {
    return null;
  }

  const media = await api.getMyProfileMediaDownloadUrl(target);
  if (media.objectKey !== expectedObjectKey) {
    return null;
  }

  return media.downloadUrl;
}

/**
 * `MyProfile` の media key を画面表示用 download URL へ解決する。
 */
export async function resolveMyProfileMediaUrls(
  api: Pick<APIClient, "getMyProfileMediaDownloadUrl">,
  profile: Pick<MyProfile, "avatarKey" | "bannerKey">,
): Promise<ResolvedMyProfileMediaUrls> {
  const [avatarUrl, bannerUrl] = await Promise.all([
    resolveMediaUrl(api, "avatar", profile.avatarKey),
    resolveMediaUrl(api, "banner", profile.bannerKey),
  ]);

  return {
    avatarUrl,
    bannerUrl,
  };
}
