import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import { getFirebaseApp } from "./app";

/**
 * Firebase Storage インスタンスを取得する。
 */
export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

/**
 * Storage の object key からダウンロード URL を取得する。
 */
export function getStorageObjectUrl(objectKey: string): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), objectKey));
}

/**
 * 指定 object key へバイナリをアップロードする。
 */
export async function uploadStorageObject(
  objectKey: string,
  data: Blob,
  contentType?: string,
): Promise<void> {
  const metadata =
    typeof contentType === "string" && contentType.trim().length > 0 ? { contentType } : undefined;

  await uploadBytes(ref(getFirebaseStorage(), objectKey), data, metadata);
}

/**
 * 指定 object key のオブジェクトを削除する。
 */
export function deleteStorageObjectByKey(objectKey: string): Promise<void> {
  return deleteObject(ref(getFirebaseStorage(), objectKey));
}
