# Prompt.md (Spec / Source of truth)

## Goals
- profile media signed upload URL 発行で MIME allowlist を明示し、`image/svg+xml` など script/embed リスクのある形式を拒否する。
- profile media upload にサイズ上限を導入し、frontend の既存 `2MB/6MB` 制約と backend / contract を整合させる。
- orphan upload / failed save 後の cleanup と観測ポイントを contract / runbook で明文化する。

## Non-goals
- profile media を public-read や CDN 配信へ切り替えない。
- avatar/banner persistence の DB schema を変えない。
- crop UI や profile settings 全体の UX 改修を行わない。

## Deliverables
- Rust profile media upload/download 実装の abuse guard 追加
- 必要な TypeScript API client / upload 呼び出しの整合
- regression tests
- contract / runbook / run memory 更新

## Done when
- [ ] SVG など不許可 MIME が upload URL 発行前に拒否される
- [ ] target ごとのサイズ上限が API / runtime / docs で一貫する
- [ ] orphan upload cleanup の運用方針と観測点が明文化される
- [ ] valid な PNG/JPEG/WebP/AVIF upload / download が既存 UI を壊さず通る

## Constraints
- Security: signed URL は private bucket + fail-close のまま維持する
- Compatibility: current profile media key persistence contract (`PATCH /users/me/profile`) は維持する
- Scope: cleanup は運用 baseline の明文化を中心にし、新しい async sweeper を必須にしない
