import { getAPIClient, type ProfileMediaTarget } from "@/shared/api/api-client";

function buildUploadHeaders(headers: Record<string, string>): Headers {
  const nextHeaders = new Headers();
  Object.entries(headers).forEach(([name, value]) => {
    nextHeaders.set(name, value);
  });
  return nextHeaders;
}

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

/**
 * プロフィール media を signed URL 経由でアップロードし、保存用 object key を返す。
 */
export async function uploadProfileMediaFile(
  target: ProfileMediaTarget,
  file: File,
): Promise<string> {
  const api = getAPIClient();
  const contentType = resolveProfileMediaContentType(file);
  const upload = await api.createMyProfileMediaUploadUrl({
    target,
    filename: file.name,
    contentType,
    sizeBytes: file.size,
  });
  const headers = buildUploadHeaders(upload.requiredHeaders);

  if (headers.has("content-type") === false && contentType.trim().length > 0) {
    headers.set("content-type", contentType);
  }

  const response = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers,
    body: file,
  });

  if (response.ok === false) {
    throw new Error(`Profile media upload failed with status ${response.status}.`);
  }

  return upload.objectKey;
}
