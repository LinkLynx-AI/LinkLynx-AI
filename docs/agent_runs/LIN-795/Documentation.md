# Documentation.md (Status / audit log)

## Current status
- Now:
  - `LIN-795` 親実装として REST rate-limit 基盤、対象 route 適用、しきい値/契約更新を完了。
  - 既存 WS 用固定窓リミッタを REST 側でも使えるよう一般化し、`429 + Retry-After` を返すようにした。
  - internal の rate-limit mutation/metrics endpoint は review 指摘を受けて撤去し、公開 API から degraded 状態を操作できない形に修正した。
- Verification:
  - `cargo test -p linklynx_backend`
  - `make rust-lint`
  - `make validate`
  - `reviewer_simple` 再レビューで internal ratelimit endpoint 起因の security finding 解消を確認

## Decisions
- Dragonfly 実クライアント導入はこの issue の非対象とし、ADR-005 の policy / threshold / observability を先に固定する。
- 高リスク経路は degraded 時に `429 + Retry-After` で fail-close し、message create は degraded 時も L1-only で継続する。
- L2 error-rate による degraded enter は単発エラーで誤作動しないよう、最低 `10` サンプル到達後に評価する。
- operational control を通常 AuthZ 経路の `View` へ載せるのは危険なので、rate-limit の internal REST endpoint は追加しない。

## How to run / demo
- 1. `cd rust && cargo test -p linklynx_backend ratelimit`
- 2. `cd rust && cargo test -p linklynx_backend main::tests`
- 3. `make rust-lint`
- 4. `make validate`

## Known issues / follow-ups
- Dragonfly への実 healthcheck / shared L2 call はまだ未接続で、rate-limit 実装は現在もノード内 L1 固定窓が中心。
- review では「実 Dragonfly-backed shared limiter への接続」と「runtime からの自動 degraded 観測投入」が追加フォローアップ候補として残った。
