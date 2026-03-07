# Documentation.md (Status / audit log)

## Current status
- Now: `LIN-911` 実装・検証完了。review blocker 修正込みで gate 再確認済み。
- Next: PR 用サマリを整える。

## Decisions
- `LIN-891` 親 issueではなく `LIN-911` にスコープを限定する。
- verify API は新規 public endpoint `GET /v1/invites/{invite_code}` として追加する。
- status は `valid | invalid | expired` の 3 値とし、disabled / max uses 到達は `invalid` に畳み込む。
- public invite verify でも既存 invite access rate limit を維持し、trusted peer 情報を使っていない間は共有 anonymous bucket で fail-close を適用する。
- `/invite/[code]` page は環境既定値に依存せず `provider: "api"` を強制して verify API を引く。
- `NEXT_PUBLIC_API_URL` は path 付き base URL を許容し、`/v1` 重複を避けて invite verify endpoint を組み立てる。
- frontend unavailable 系は `invalid` と分離し、画面には固定の利用者向け文言のみを出す。

## How to run / demo
- `GET /v1/invites/DEVJOIN2026` で `status=valid` の invite verify を返す。
- `GET /v1/invites/EXPIRED2026` で `status=expired` を返す。
- frontend は `NEXT_PUBLIC_API_URL=<backend>` を設定して `/invite/DEVJOIN2026` を開く。
- 実行済み validation:
  - `cargo test -p linklynx_backend invite`
  - `cd typescript && npm run test -- src/entities/ui-gateway/api/api-ui-gateway.test.ts src/features/invite-flow/ui/invite-route-preview.test.tsx src/app/invite/[code]/page.test.tsx`
  - `cd typescript && npm run typecheck`
  - `make validate`
  - `make rust-lint`
- Python 側の dev tools 未セット環境では `cd python && make setup` が必要だったため、repo 内 `.venv` を作成して validation を通した。

## Review notes
- 初回 review で出た blocker はすべて解消した。
  - mock gateway 既定値を拾わないよう `/invite/[code]` で API provider を強制。
  - spoof 可能ヘッダーや invite code fallback に依存しない共有匿名 bucket へ変更。
  - path 付き `NEXT_PUBLIC_API_URL` の `/v1/v1/...` 二重連結を解消。
  - disabled/maxed-out と expired が同時成立する場合に `invalid` を優先。
  - unavailable UI を `invalid` から分離し、内部エラー文言を非表示化。
- CI follow-up として `db-schema-check` job の Postgres wait を `pg_isready` 単体から `select 1` 成功を含む query-ready 判定へ強化した。

## Known issues / follow-ups
- `LIN-912` で join API と membership 整合を実装する必要がある。
- `LIN-913` で login 復帰導線と参加後遷移を実装する必要がある。
