# LIN-643 Documentation

## Current status
- Now: 実装完了（コード反映 + Rustゲート通過）
- Next: TypeScript実行環境（Node/pnpm）を合わせて `make validate` を再実行

## Decisions
- `auth.reauthenticate` の受信payloadは `d.idToken` を採用（互換より一貫性を優先）。
- WS ticket APIは `POST /auth/ws-ticket` で実装。
- Origin allowlistの未設定デフォルトは localhost系2件。
- rate limitは v1前提のインメモリ固定窓で実装。

## How to run / demo
1. `POST /auth/ws-ticket` にBearer付きでアクセスし、`ticket` を取得する。
2. `GET /ws` へ接続し、`auth.identify` を送る。
3. `auth.ready` 受信後に通常メッセージが処理されることを確認する。
4. 同じticket再利用で `1008` が返ることを確認する。
5. identify未送信で timeout -> `1008` を確認する。

## Validation summary
- `make rust-lint`: passed
- `make validate`: failed
  - 失敗箇所: TypeScript `vitest`
  - 失敗内容: `ERR_REQUIRE_ESM`（`html-encoding-sniffer` / `@exodus/bytes`）
  - 備考: Node engine警告（v22.4.0 < package要件）あり

## Known issues / follow-ups
- TypeScript側の Nodeバージョン要件を満たす実行環境で `make validate` 再確認が必要。
