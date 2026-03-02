import {
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";
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
 * 認証永続化設定をブラウザ永続(local)で初期化する。
 * ブラウザ制約でlocal永続が利用できない場合は、in-memoryへフォールバックする。
 */
export function ensureFirebaseAuthPersistence(): Promise<void> {
  if (persistenceSetupPromise !== null) {
    return persistenceSetupPromise;
  }

  const auth = getOrCreateAuth();
  persistenceSetupPromise = setPersistence(auth, browserLocalPersistence).catch(
    async (error: unknown) => {
      console.warn(
        "Browser local persistence is unavailable. Falling back to in-memory persistence.",
        error,
      );
      await setPersistence(auth, inMemoryPersistence);
    },
  );

  return persistenceSetupPromise;
}
