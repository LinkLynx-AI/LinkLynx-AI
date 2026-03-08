# LIN-939 Documentation

## Current status
- Completed: backend/profile media 契約、TypeScript client 契約、DB migration、関連ドキュメントを実装
- Closed: validation 完走済み。残タスクは runtime smoke のみ

## Decisions
- avatar/banner は同一 profile-media bucket を使う
- 表示契約は object key 保持 + signed download URL 再取得
- UI 即時反映は LIN-886 に残し、LIN-939 では契約と最小 API に絞る
- profile key は `user/{principal_id}/profile/{target}` 固定プレフィックスに限定し、他人/他target の key を `PATCH /users/me/profile` で受け付けない
- signer は local の `GOOGLE_APPLICATION_CREDENTIALS` と、staging/prod の attached service account の両方を許容する

## How to run / demo
- local env に `PROFILE_GCS_BUCKET` と `GOOGLE_APPLICATION_CREDENTIALS` を設定する
- `POST /users/me/profile/media/upload-url` で `object_key` と signed `PUT` URL を取得する
- signed `PUT` 実行後に `PATCH /users/me/profile` で `avatar_key` または `banner_key` を保存する
- `GET /users/me/profile/media/{target}/download-url` で都度 signed download URL を再取得する

## Validation
- `cargo test -p linklynx_backend profile`: passed
- `cargo test -p linklynx_backend patch_my_profile`: passed
- `npm -C typescript run typecheck`: passed
- `npm -C typescript run test -- src/shared/api/guild-channel-api-client.test.ts src/features/settings/ui/user/user-profile.test.tsx`: passed
- `make validate`: passed
  - first run in sandbox hit `Operation not permitted` on existing Rust WS/AuthZ tests that open local sockets
  - reran with escalation and the full validation suite passed

## Review
- Manual review after final contract-alignment fixes: no actionable findings remained
- Focus points:
  - `PATCH /users/me/profile` cannot persist arbitrary/cross-principal profile media keys
  - runtime signer path now matches the documented local vs attached-service-account execution model
  - content-type validation rejects control characters before signed-header generation

## Files changed
- backend:
  - `rust/apps/api/src/profile/**`
  - `rust/apps/api/src/main.rs`
  - `rust/apps/api/src/main/http_routes.rs`
  - `rust/apps/api/src/main/tests.rs`
- schema/contracts/docs:
  - `database/postgres/migrations/0017_lin939_profile_banner_key.*.sql`
  - `database/contracts/lin939_profile_media_gcs_contract.md`
  - `docs/runbooks/profile-media-gcs-operations-runbook.md`
  - `docs/DATABASE.md`
  - `docs/runbooks/README.md`
  - `docs/V1_TRACEABILITY.md`
- frontend client:
  - `typescript/src/shared/api/**`
  - `typescript/src/features/settings/ui/user/user-profile.test.tsx`

## Known issues / follow-ups
- 実 bucket 名と credential 実値は repo に含めない
- runtime smoke は実 bucket / credential が必要
