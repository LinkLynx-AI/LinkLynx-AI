import type { GuardKind } from "@/shared/config";
import { RouteGuardScreen } from "./route-guard-screen";

type ProtectedPreviewGateProps = {
  guard: GuardKind | null;
  children: React.ReactNode;
};

/**
 * クエリ指定に応じて保護ルートのガード画面を切り替える。
 */
export function ProtectedPreviewGate({ guard, children }: ProtectedPreviewGateProps) {
  if (guard !== null) {
    return <RouteGuardScreen kind={guard} />;
  }

  return <>{children}</>;
}
