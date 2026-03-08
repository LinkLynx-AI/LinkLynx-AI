# LIN-939 Plan

## Rules
- Stop-and-fix: validation が落ちたら次に進む前に修正する。

## Milestones
### M1: Backend 契約を追加する
- Acceptance criteria:
  - [x] `users.banner_key` が追加され、`GET/PATCH /users/me/profile` に反映される
  - [x] `POST /users/me/profile/media/upload-url` と `GET /users/me/profile/media/{target}/download-url` が追加される
  - [x] object key 生成と fail-close error 契約がテストされる
- Validation:
  - `cargo test -p linklynx_backend profile`

### M2: TypeScript client 契約を揃える
- Acceptance criteria:
  - [x] `MyProfile` / `UpdateMyProfileInput` に `bannerKey` が追加される
  - [x] profile media API client メソッドとテストが追加される
- Validation:
  - `cd typescript && npm run test -- src/shared/api/guild-channel-api-client.test.ts`
  - `cd typescript && npm run typecheck`

### M3: Docs と運用項目を固定する
- Acceptance criteria:
  - [x] profile media 契約書と runbook が追加される
  - [x] `docs/DATABASE.md` / `docs/runbooks/README.md` / `docs/V1_TRACEABILITY.md` が更新される
  - [x] validation/review 結果が Documentation.md に記録される
- Validation:
  - `make validate`
