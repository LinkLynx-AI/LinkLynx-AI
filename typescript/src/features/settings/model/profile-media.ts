import { getAPIClient, type ProfileMediaTarget } from "@/shared/api/api-client";

function buildUploadHeaders(headers: Record<string, string>): Headers {
  const nextHeaders = new Headers();
  Object.entries(headers).forEach(([name, value]) => {
    nextHeaders.set(name, value);
  });
  return nextHeaders;
}

/**
 * プロフィール media を signed URL 経由でアップロードし、保存用 object key を返す。
 */
export async function uploadProfileMediaFile(
  target: ProfileMediaTarget,
  file: File,
): Promise<string> {
  const api = getAPIClient();
  const upload = await api.createMyProfileMediaUploadUrl({
    target,
    filename: file.name,
    contentType: file.type,
  });
  const headers = buildUploadHeaders(upload.requiredHeaders);

  if (headers.has("content-type") === false && file.type.trim().length > 0) {
    headers.set("content-type", file.type);
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
