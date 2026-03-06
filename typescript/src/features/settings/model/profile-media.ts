import { deleteStorageObjectByKey, uploadStorageObject } from "@/shared/lib";

export type ProfileMediaTarget = "avatar" | "banner";

const PROFILE_MEDIA_KEY_SEGMENT_RE = /[^A-Za-z0-9_-]+/g;
const PROFILE_MEDIA_EXTENSION_RE = /\.([A-Za-z0-9]+)$/;

function sanitizeProfileMediaSegment(value: string, fallback: string): string {
  const normalized = value.trim().replace(PROFILE_MEDIA_KEY_SEGMENT_RE, "_");
  return normalized.length > 0 ? normalized : fallback;
}

function resolveProfileMediaExtension(file: File): string {
  const fileNameMatch = file.name.match(PROFILE_MEDIA_EXTENSION_RE);
  if (fileNameMatch !== null) {
    return sanitizeProfileMediaSegment(fileNameMatch[1].toLowerCase(), "bin");
  }

  const [, rawSubtype = "bin"] = file.type.split("/");
  const normalizedSubtype = rawSubtype.split("+")[0] ?? "bin";
  return sanitizeProfileMediaSegment(normalizedSubtype.toLowerCase(), "bin");
}

/**
 * プロフィール画像の保存 key を生成する。
 */
export function buildProfileMediaObjectKey(
  userId: string,
  target: ProfileMediaTarget,
  file: File,
): string {
  const sanitizedUserId = sanitizeProfileMediaSegment(userId, "user");
  const fileExtension = resolveProfileMediaExtension(file);

  return `profiles/${sanitizedUserId}/${target}/${crypto.randomUUID()}.${fileExtension}`;
}

/**
 * プロフィール画像を Storage にアップロードし、保存 key を返す。
 */
export async function uploadProfileMediaFile(
  userId: string,
  target: ProfileMediaTarget,
  file: File,
): Promise<string> {
  const objectKey = buildProfileMediaObjectKey(userId, target, file);
  await uploadStorageObject(objectKey, file, file.type);
  return objectKey;
}

/**
 * 途中で作成したプロフィール画像 object を best-effort で削除する。
 */
export async function cleanupUploadedProfileMediaKeys(objectKeys: string[]): Promise<void> {
  await Promise.allSettled(objectKeys.map((objectKey) => deleteStorageObjectByKey(objectKey)));
}
