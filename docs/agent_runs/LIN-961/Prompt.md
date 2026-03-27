# Prompt.md (Spec / Source of truth)

## Goals
- Phase 1 の edge baseline を `GCP native edge` として ADR と関連 docs に固定する。
- `Cloud DNS / Certificate Manager / GCLB / Cloud Armor / Cloud CDN(static only)` の責務分界を明文化する。
- `API Gateway は main path では不要` をドキュメント上で明示する。

## Non-goals
- 実際の GCP edge リソースを Terraform で構築すること。
- GKE / DB / 監視など edge 以外の基盤実装に踏み込むこと。

## Deliverables
- 新規 ADR 1本。
- `docs/infra/01_decisions.md` の edge 方針更新。
- `docs/runbooks/edge-rest-ws-routing-drain-runbook.md` の routing contract 更新。

## Done when
- [ ] CDN / DNS / TLS / WAF / DDoS の責務分担が ADR に明記されている。
- [ ] staging / prod のトラフィック経路と切り戻し方針が記載されている。
- [ ] 既存 docs の Cloudflare 前提が Phase 1 方針と矛盾しない。

## Constraints
- Perf: WebSocket 経路を壊さない責務分解にする。
- Security: WAF / DDoS / cert expiry を監視対象として残す。
- Compatibility: 後続の LIN-963 が Terraform に落としやすい責務境界にする。
