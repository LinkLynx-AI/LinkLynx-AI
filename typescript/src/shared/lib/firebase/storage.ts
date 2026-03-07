import { z } from "zod";
import { getFirebaseAuth } from "./auth";

const STORAGE_PROXY_ERROR_SCHEMA = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
});
const STORAGE_OBJECT_URL_RESPONSE_SCHEMA = z.object({
  url: z.string().url(),
});
const STORAGE_PROXY_PATH = "/api/storage/object";

type StorageProxyErrorCode =
  | "unauthenticated"
  | "token-unavailable"
  | "network-request-failed"
  | "storage-request-failed";

/**
 * Storage proxy 経由の失敗を表現する。
 */
export class StorageProxyError extends Error {
  readonly code: StorageProxyErrorCode;
  readonly status: number | null;

  constructor(message: string, code: StorageProxyErrorCode, status: number | null = null) {
    super(message);
    this.name = "StorageProxyError";
    this.code = code;
    this.status = status;
  }
}

async function authenticatedStorageFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const currentUser = getFirebaseAuth().currentUser;
  if (currentUser === null) {
    throw new StorageProxyError(
      "ログイン状態を確認してから再試行してください。",
      "unauthenticated",
      401,
    );
  }

  let idToken: string;
  try {
    idToken = await currentUser.getIdToken();
  } catch {
    throw new StorageProxyError(
      "IDトークンの取得に失敗しました。時間を置いて再試行してください。",
      "token-unavailable",
      null,
    );
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${idToken}`);

  try {
    return await fetch(input, {
      ...init,
      headers,
    });
  } catch {
    throw new StorageProxyError(
      "ストレージAPIへの接続に失敗しました。",
      "network-request-failed",
      null,
    );
  }
}

async function assertStorageProxyResponse(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const text = await response.text();
  let payload: unknown = { code: "storage-request-failed", message: fallbackMessage };
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { code: "storage-request-failed", message: fallbackMessage };
    }
  }

  const parsed = STORAGE_PROXY_ERROR_SCHEMA.safeParse(payload);
  if (parsed.success) {
    throw new StorageProxyError(parsed.data.message, "storage-request-failed", response.status);
  }

  throw new StorageProxyError(fallbackMessage, "storage-request-failed", response.status);
}

/**
 * Storage の object key からダウンロード URL を取得する。
 */
export async function getStorageObjectUrl(objectKey: string): Promise<string> {
  const response = await authenticatedStorageFetch(
    `${STORAGE_PROXY_PATH}?objectKey=${encodeURIComponent(objectKey)}`,
    { method: "GET" },
  );
  await assertStorageProxyResponse(response, "Storage object の取得に失敗しました。");

  const json = await response.json();
  return STORAGE_OBJECT_URL_RESPONSE_SCHEMA.parse(json).url;
}

/**
 * 指定 object key へバイナリをアップロードする。
 */
export async function uploadStorageObject(
  objectKey: string,
  data: Blob,
  contentType?: string,
): Promise<void> {
  const formData = new FormData();
  const file =
    data instanceof File
      ? data
      : new File([data], "upload.bin", { type: contentType || data.type || undefined });
  formData.set("objectKey", objectKey);
  formData.set("file", file);

  const response = await authenticatedStorageFetch(STORAGE_PROXY_PATH, {
    method: "POST",
    body: formData,
  });
  await assertStorageProxyResponse(response, "Storage object のアップロードに失敗しました。");
}

/**
 * 指定 object key のオブジェクトを削除する。
 */
export async function deleteStorageObjectByKey(objectKey: string): Promise<void> {
  const response = await authenticatedStorageFetch(STORAGE_PROXY_PATH, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ objectKey }),
  });
  await assertStorageProxyResponse(response, "Storage object の削除に失敗しました。");
}
