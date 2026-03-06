export type WsConnectionStatePhase = "idle" | "connecting" | "identifying" | "ready" | "closed";

export type WsCloseKind =
  | "policy-violation"
  | "dependency-unavailable"
  | "normal"
  | "transport-error"
  | "manual";

export type WsConnectionState = {
  phase: WsConnectionStatePhase;
  closeCode: number | null;
  closeReason: string | null;
  closeKind: WsCloseKind | null;
  reconnectAttempt: number;
  nextRetryInMs: number | null;
};

/**
 * WS接続状態の初期値を生成する。
 */
export function createInitialWsConnectionState(): WsConnectionState {
  return {
    phase: "idle",
    closeCode: null,
    closeReason: null,
    closeKind: null,
    reconnectAttempt: 0,
    nextRetryInMs: null,
  };
}
