# Plan.md (Milestones + validations)

## Rules
- Stop-and-fix: if validation fails, repair it before moving to the next step.

## Milestones
### M1: API層にプロフィールGET/PATCHを追加
- Acceptance criteria:
  - [x] `APIClient` に `getMyProfile` / `updateMyProfile` が追加される。
  - [x] `GuildChannelAPIClient` で `/users/me/profile` を実装し、境界検証する。
- Validation:
  - `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts`

### M2: Query/Mutation hooksとUI接続
- Acceptance criteria:
  - [x] `useMyProfile` / `useUpdateMyProfile` を追加する。
  - [x] `UserProfile` で読み込み・更新・成功/失敗・再試行を実装する。
  - [x] 更新結果を `auth-store` に反映してユーザーパネル表示を同期する。
- Validation:
  - `cd typescript && npm run typecheck`

### M3: テスト・品質ゲート
- Acceptance criteria:
  - [x] UI連携の主要ケースをテストで固定する。
  - [x] required quality commands の結果を記録する。
- Validation:
  - `make validate`
  - `make rust-lint`
  - `cd typescript && npm run typecheck`
