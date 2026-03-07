# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-925` で追加した permission snapshot を使い、FE の ActionGuard と実操作 API 判定を整合させる。
- fail-close を維持し、権限不足や AuthZ unavailable 時に FE が fail-open しないようにする。

## Non-goals
- 新しい権限判定軸の追加。
- invite 作成 API/client の新規実装。
- `LIN-926` と無関係な UI 改修や refactor。

## Deliverables
- permission snapshot を利用する frontend ActionGuard 層。
- server/channel/moderation の対象 UI に対する fail-close guard 適用。
- invite 作成導線を一旦停止する変更。
- guard 契約を反映した docs と回帰テスト。

## Done when
- [ ] FE guard と API 判定が矛盾しない。
- [ ] loading / unavailable を含めて fail-close を維持する。
- [ ] invite 作成導線が誤って開かない。
- [ ] `make validate` と `make rust-lint` が通る。
- [ ] review gate と runtime smoke の証跡が揃う。

## Constraints
- Perf: snapshot の取得は React Query を使い、同一キーで共有する。
- Security: ADR-004 に従い fail-open や stale fallback を入れない。
- Compatibility: backend の permission snapshot 契約は変更しない。
