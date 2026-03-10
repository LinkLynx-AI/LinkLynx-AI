# Prompt.md (Spec / Source of truth)

## Goals
- `LIN-909` として保存済みプロフィール画像変更が主要 UI に反映される状態を成立させる。
- アバター・バナー変更が save 成功直後と再読込後の両方で `auth-store` / profile query / 主要 UI に整合して表示されるようにする。
- 保存失敗時に既存の retry 導線を維持する。

## Non-goals
- 既存プロフィール編集 UX から外れる別 feature の追加。
- プロフィール編集 UI の全面 redesign。

## Deliverables
- `auth-store` と profile query cache を `MyProfile` 成功結果へ同期する frontend 実装。
- reload 後に session fallback を保存済み profile で上書きする bridge 実装。
- avatar / banner 反映回帰を防ぐ frontend test 更新。
- `banner_key` を扱える DB / Rust / API client 契約の追加。
- 実装判断と制約を記録した `Plan.md`, `Implement.md`, `Documentation.md`。

## Done when
- [ ] 保存済み avatar / banner が settings profile preview と主要 UI に反映される。
- [ ] 再読込後も `myProfile.avatarKey` / `myProfile.bannerKey` 由来の表示が維持される。
- [ ] 保存失敗時に既存 retry 導線が維持される。
- [ ] `make validate` と `cd typescript && npm run typecheck` が通る。

## Constraints
- Perf: 既存 `useMyProfile` query を再利用し、不要な追加 fetch は増やさない。
- Security: 既存 storage を使い、追加の upload サービスや認可モデルは導入しない。
- Compatibility: `banner_key` 追加は additive change に限定し、既存 `avatar_key` / `status_text` 契約を壊さない。
