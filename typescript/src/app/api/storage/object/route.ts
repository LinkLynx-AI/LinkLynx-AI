import { NextResponse } from "next/server";
import { z } from "zod";

const OBJECT_KEY_SCHEMA = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9/_.-]+$/);
const DELETE_REQUEST_SCHEMA = z.object({
  objectKey: OBJECT_KEY_SCHEMA,
});
const STORAGE_METADATA_SCHEMA = z.object({
  bucket: z.string().trim().min(1),
  name: z.string().trim().min(1),
  downloadTokens: z.string().trim().min(1).optional(),
});

type StorageRouteErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "STORAGE_REQUEST_FAILED"
  | "STORAGE_OBJECT_NOT_FOUND"
  | "DOWNLOAD_URL_UNAVAILABLE"
  | "STORAGE_BUCKET_UNAVAILABLE";

function jsonError(status: number, code: StorageRouteErrorCode, message: string): NextResponse {
  return NextResponse.json({ code, message }, { status });
}

function resolveStorageBucket(): string | null {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? "";
  return bucket.length > 0 ? bucket : null;
}

function parseBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function buildObjectMetadataUrl(bucket: string, objectKey: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectKey)}`;
}

function buildBucketObjectsUrl(bucket: string, objectKey: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?name=${encodeURIComponent(objectKey)}`;
}

function buildDownloadUrl(bucket: string, objectKey: string, downloadToken: string): string {
  return `${buildObjectMetadataUrl(bucket, objectKey)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
}

function resolveContentType(file: File): string {
  const normalized = file.type.trim();
  return normalized.length > 0 ? normalized : "application/octet-stream";
}

function buildMultipartUploadBody(objectKey: string, file: File): {
  body: Blob;
  boundary: string;
} {
  const boundary = `linklynx-${crypto.randomUUID()}`;
  const contentType = resolveContentType(file);
  const metadata = JSON.stringify({
    name: objectKey,
    fullPath: objectKey,
    contentType,
  });
  const preamble =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=utf-8\r\n\r\n" +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  return {
    body: new Blob([preamble, file, closing]),
    boundary,
  };
}

async function parseStorageMetadataResponse(response: Response): Promise<z.infer<typeof STORAGE_METADATA_SCHEMA>> {
  const json = await response.json();
  return STORAGE_METADATA_SCHEMA.parse(json);
}

async function forwardStorageRequest(
  input: string,
  init: RequestInit,
  firebaseToken: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Firebase ${firebaseToken}`);

  return fetch(input, {
    ...init,
    cache: "no-store",
    headers,
  });
}

/**
 * Storage object key からダウンロード URL を解決する。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const firebaseToken = parseBearerToken(request);
  if (firebaseToken === null) {
    return jsonError(401, "UNAUTHENTICATED", "ログイン状態を確認してから再試行してください。");
  }

  const bucket = resolveStorageBucket();
  if (bucket === null) {
    return jsonError(500, "STORAGE_BUCKET_UNAVAILABLE", "Storage bucket の設定が不足しています。");
  }

  const rawObjectKey = new URL(request.url).searchParams.get("objectKey");
  const parsedObjectKey = OBJECT_KEY_SCHEMA.safeParse(rawObjectKey);
  if (!parsedObjectKey.success) {
    return jsonError(400, "VALIDATION_ERROR", "Storage object key が不正です。");
  }

  let response: Response;
  try {
    response = await forwardStorageRequest(
      buildObjectMetadataUrl(bucket, parsedObjectKey.data),
      { method: "GET" },
      firebaseToken,
    );
  } catch {
    return jsonError(502, "STORAGE_REQUEST_FAILED", "Storage object の取得に失敗しました。");
  }

  if (response.status === 404) {
    return NextResponse.json({ url: null });
  }
  if (!response.ok) {
    return jsonError(response.status, "STORAGE_REQUEST_FAILED", "Storage object の取得に失敗しました。");
  }

  const metadata = await parseStorageMetadataResponse(response);
  const firstDownloadToken = metadata.downloadTokens?.split(",")[0]?.trim() ?? "";
  if (firstDownloadToken.length === 0) {
    return NextResponse.json({ url: null });
  }

  return NextResponse.json({
    url: buildDownloadUrl(metadata.bucket, metadata.name, firstDownloadToken),
  });
}

/**
 * Storage object をアップロードする。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const firebaseToken = parseBearerToken(request);
  if (firebaseToken === null) {
    return jsonError(401, "UNAUTHENTICATED", "ログイン状態を確認してから再試行してください。");
  }

  const bucket = resolveStorageBucket();
  if (bucket === null) {
    return jsonError(500, "STORAGE_BUCKET_UNAVAILABLE", "Storage bucket の設定が不足しています。");
  }

  const formData = await request.formData();
  const rawObjectKey = formData.get("objectKey");
  const rawFile = formData.get("file");
  const parsedObjectKey = OBJECT_KEY_SCHEMA.safeParse(rawObjectKey);
  if (!parsedObjectKey.success || !(rawFile instanceof File)) {
    return jsonError(400, "VALIDATION_ERROR", "アップロード入力が不正です。");
  }

  const { body, boundary } = buildMultipartUploadBody(parsedObjectKey.data, rawFile);

  let response: Response;
  try {
    response = await forwardStorageRequest(
      buildBucketObjectsUrl(bucket, parsedObjectKey.data),
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "X-Goog-Upload-Protocol": "multipart",
        },
        body,
      },
      firebaseToken,
    );
  } catch {
    return jsonError(502, "STORAGE_REQUEST_FAILED", "Storage object のアップロードに失敗しました。");
  }

  if (!response.ok) {
    return jsonError(response.status, "STORAGE_REQUEST_FAILED", "Storage object のアップロードに失敗しました。");
  }

  return NextResponse.json({ ok: true });
}

/**
 * Storage object を削除する。
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const firebaseToken = parseBearerToken(request);
  if (firebaseToken === null) {
    return jsonError(401, "UNAUTHENTICATED", "ログイン状態を確認してから再試行してください。");
  }

  const bucket = resolveStorageBucket();
  if (bucket === null) {
    return jsonError(500, "STORAGE_BUCKET_UNAVAILABLE", "Storage bucket の設定が不足しています。");
  }

  const json = await request.json().catch(() => null);
  const parsedRequest = DELETE_REQUEST_SCHEMA.safeParse(json);
  if (!parsedRequest.success) {
    return jsonError(400, "VALIDATION_ERROR", "Storage object key が不正です。");
  }

  let response: Response;
  try {
    response = await forwardStorageRequest(
      buildObjectMetadataUrl(bucket, parsedRequest.data.objectKey),
      { method: "DELETE" },
      firebaseToken,
    );
  } catch {
    return jsonError(502, "STORAGE_REQUEST_FAILED", "Storage object の削除に失敗しました。");
  }

  if (response.status === 404) {
    return jsonError(404, "STORAGE_OBJECT_NOT_FOUND", "Storage object が見つかりません。");
  }
  if (![200, 204].includes(response.status)) {
    return jsonError(response.status, "STORAGE_REQUEST_FAILED", "Storage object の削除に失敗しました。");
  }

  return NextResponse.json({ ok: true });
}
