# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-910` として `/users/me/profile` の既存契約を使い、display name / status の保存・再読込後反映を成立させる。
- 設定画面での保存成功時に主要画面へ即時反映されるようにする。
- 認証後の初期化で profile API の値を `auth-store` に反映し、リロード後も表示が戻らないようにする。

## Non-goals
- avatar / banner 保存反映の完了。
- profile API の新規項目追加や DB migration。
- 高度なプロフィール編集 UI の拡張。

## Deliverables
- `AuthBridge` の profile hydration。
- `useUpdateMyProfile` からの `auth-store` / relevant query cache 同期。
- 実装判断と検証結果を記録した `Plan.md`, `Implement.md`, `Documentation.md`。

## Done when
- [ ] profile 保存後に display name / status が主要画面へ即時反映される。
- [ ] リロード後も profile API 由来の display name / status が復元される。
- [ ] `make validate` と `cd typescript && npm run typecheck` が通る。

## Constraints
- Perf: profile 同期は局所 patch を優先し、不要な全面再取得を避ける。
- Security: 認証・API 契約は既存のまま維持し、fail-soft な hydration に留める。
- Compatibility: `/users/me/profile` の request/response shape は変更しない。
