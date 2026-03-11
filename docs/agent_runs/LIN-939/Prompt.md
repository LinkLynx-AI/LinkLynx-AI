# LIN-939 Prompt

## Goals
- プロフィール画像の保存先を GCS に固定する。
- avatar/banner の object key 命名、signed URL 発行、保持境界を profile 用に具体化する。
- 後続の LIN-886 が依存できる最小 API 契約と DB 契約を追加する。

## Non-goals
- プロフィール画面での即時反映 UI 実装
- 画像トリミング/リサイズ/CDN 最適化
- メッセージ添付など他ドメインの GCS 利用拡張

## Deliverables
- `users.banner_key` を含む profile API 拡張
- profile media signed URL 発行 API
- GCS profile media 契約書と runbook
- LIN-939 run memory

## Done when
- [ ] GCS SoR と object key/persistence 責務が repo 内で明文化されている
- [ ] avatar/banner の最小 upload/download 契約が backend と TypeScript client に入っている
- [ ] bucket/credential/CORS/env 項目が docs に列挙されている
- [ ] validation と review の結果が Documentation.md に記録されている

## Constraints
- Perf: signed URL TTL は LIN-590 baseline に合わせて 5 分
- Security: object は private のまま、public URL 永続化はしない
- Compatibility: 既存 profile 契約への変更は additive のみ
