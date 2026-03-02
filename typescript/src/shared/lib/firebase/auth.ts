import { getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";
import { getFirebaseApp } from "./app";

let authInstance: Auth | null = null;
let persistenceSetupPromise: Promise<void> | null = null;

function getOrCreateAuth(): Auth {
  if (authInstance !== null) {
    return authInstance;
  }

  authInstance = getAuth(getFirebaseApp());
  return authInstance;
}

/**
 * Firebase Auth インスタンスを取得する。
 */
export function getFirebaseAuth(): Auth {
  return getOrCreateAuth();
}

/**
 * 認証永続化設定をメモリ限定で初期化する。
 */
export function ensureFirebaseAuthPersistence(): Promise<void> {
  if (persistenceSetupPromise !== null) {
    return persistenceSetupPromise;
  }

  persistenceSetupPromise = setPersistence(getOrCreateAuth(), inMemoryPersistence);
  return persistenceSetupPromise;
}
