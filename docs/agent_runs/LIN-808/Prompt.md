# Prompt.md (Spec / Source of truth)

## Goals
- LIN-808 として `/users/me/profile` の `theme` 取得・更新契約を実装する。
- Rust API と TypeScript API client 契約を同時に更新し、既存プロフィール導線と整合させる。
- 既存 DB 制約に合わせて `theme` の値域を `dark | light` に固定する。

## Non-goals
- `UserAppearance` の保存導線実装。
- `ash` / `onyx` / `system` の永続化対応。
- DB migration の追加。

## Deliverables
- Rust profile service / route / tests に `theme` を追加。
- TypeScript の `MyProfile` / `UpdateMyProfileInput` / API client 実装に `theme` を追加。
- mock / no-data client でも同じ契約を維持する。
- LIN-808 の検証結果とレビュー結果を `Documentation.md` に記録する。

## Done when
- [ ] `GET /users/me/profile` が `theme` を返す。
- [ ] `PATCH /users/me/profile` が `theme` を更新できる。
- [ ] 不正な `theme` 値が `VALIDATION_ERROR` で拒否される。
- [ ] TypeScript API client が `theme` を読み書きできる。

## Constraints
- Perf: 既存 query key / cache 更新の挙動を悪化させない。
- Security: 既存の認証付き profile API 経路を踏襲する。
- Compatibility: 既存 profile 契約に additive に `theme` を追加し、既存 3 項目の挙動を変えない。
