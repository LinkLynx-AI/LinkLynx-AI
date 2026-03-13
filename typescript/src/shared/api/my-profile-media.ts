import type { APIClient, MyProfile, ProfileMediaTarget } from "./api-client";

export type ResolvedMyProfileMediaUrls = {
  avatarUrl: string | null;
  bannerUrl: string | null;
};

type ProfileMediaApi = Pick<
  APIClient,
  "createMyProfileMediaUploadUrl" | "getMyProfileMediaDownloadUrl"
>;

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
  const contentType = file.type.trim().length > 0 ? file.type : "application/octet-stream";
  const upload = await api.createMyProfileMediaUploadUrl({
    target,
    filename: buildUploadFilename(target, file),
    contentType,
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
