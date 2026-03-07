# Documentation.md (Status / audit log)

## Current status
- Now: Scylla runtime / health / bootstrap foundation の実装と検証は完了
- Next: review gate の回収結果を最終整理する

## Decisions
- Schema apply は起動時自動適用ではなく明示 bootstrap command に分離する。
- `GET /health` は既存互換を維持し、Scylla 詳細状態は `/internal/scylla/health` に分離する。
- `/internal/scylla/health` の public response は tri-state + coarse reason code のみを返し、path/driver error などの詳細はログへ残す。
- LIN-936 では `rust/crates/platform/scylla/message` の adapter 実装までは踏み込まない。

## Validation log
- `cd rust && cargo test -p linklynx_backend scylla_health -- --nocapture`: pass
- `cd rust && cargo test -p linklynx_backend health_ -- --nocapture`: pass
- `cd rust && cargo fmt --all`: pass
- `make rust-lint`: pass
  - sandbox では既存 SpiceDB test の localhost bind が `Operation not permitted` になるため escalated で再実行した。
- `cd typescript && CI=true pnpm install --frozen-lockfile`: pass
  - `make validate` 実行前に TypeScript 依存関係が未インストールだったため補完した。
- `make validate`: pass
  - sandbox では既存 SpiceDB test の localhost bind が同様に失敗するため escalated で再実行した。

## Runtime smoke
- `make db-up`: pass
- `make rust-dev`: pass
- bootstrap 前の `GET /internal/scylla/health`: `200` + `{"service":"scylla","status":"degraded","reason":"keyspace_missing"}`
- `make scylla-bootstrap`: pass
- bootstrap 後の `GET /internal/scylla/health`: `200` + `{"service":"scylla","status":"ready"}`
- `GET /health`: `200 OK` + `OK`

## Review gates
- `reviewer_ui_guard`: pass
  - UI 変更なし。対象差分は Rust / config / docs / compose / Makefile のみ。
- `reviewer`: fallback
  - `reviewer` / `reviewer_simple` を複数回実行したが、repo 探索フェーズでタイムアウトしたため結果を取得できなかった。
  - fallback として main rollout 側で diff review と `git diff --check` を実施し、blocking finding は確認されなかった。

## How to run / demo
- `make db-up`
- `make scylla-bootstrap`
- `make rust-dev`
- `curl -i -sS http://127.0.0.1:8080/health`
- `curl -i -sS http://127.0.0.1:8080/internal/scylla/health`

## Known issues / follow-ups
- CI/常設 integration での Scylla runtime 検証は後続 issue 側で拡張する余地がある。
- message append/list の adapter 実装は LIN-847 / LIN-937 側の責務。
