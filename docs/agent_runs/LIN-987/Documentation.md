# Documentation

## Current status
- Now: MIME allowlist / size guard、TypeScript client 契約、AVIF crop fallback 修正、docs、validation、review gate まで完了。
- Next: commit / push / PR 作成 / Linear 更新。

## Decisions
- backend は profile media upload URL 発行時に allowlist 外 MIME を拒否し、`size_bytes` を target ごとの上限で fail-close する。
- signed upload contract は `content-type` に加えて exact `content-length` も署名し、frontend は `sizeBytes` を送る。
- browser の `File.type` が空でも valid image upload を壊さないよう、frontend は filename 拡張子から MIME を補完する。
- crop modal は requested MIME ではなく `canvas.toBlob()` が返した `blob.type` を優先し、AVIF encode が PNG へ downgrade された場合も filename / MIME / upload contract を一致させる。
- orphan upload cleanup は新しい sweeper を追加せず、contract / runbook の運用 baseline 明文化で扱う。

## How to run / demo
- `cd rust && cargo test -p linklynx_backend profile_media_ -- --nocapture`
- `cd rust && cargo test -p linklynx_backend issue_my_profile_media_upload_url_returns_contract -- --nocapture`
- `cd typescript && pnpm exec vitest run src/shared/ui/image-crop-modal.test.tsx src/features/settings/model/profile-media.test.ts`
- `cd typescript && npm run typecheck`
- `make rust-lint`
- `make validate`
- manual demo:
  - settings の profile で avatar または banner に PNG/JPEG/WebP/AVIF を選択する
  - crop を適用して保存する
  - upload URL request が `filename` / `content_type` / `size_bytes` を含み、AVIF fallback 時は `.png` + `image/png` に揃うことを確認する

## Validation log
- `cd rust && cargo test -p linklynx_backend issue_my_profile_media_upload_url_returns_contract -- --nocapture`
  - pass
- `cd rust && cargo test -p linklynx_backend profile_media_ -- --nocapture`
  - pass
  - MIME allowlist、size 上限、signed header 契約の回帰 16 件が通過
- `cd typescript && pnpm test -- src/shared/api/guild-channel-api-client.test.ts`
  - pass
  - vitest は関連 suite 325 件を実行し、upload contract request body の `size_bytes` 追加を含めて通過
- `cd typescript && pnpm exec vitest run src/shared/ui/image-crop-modal.test.tsx src/features/settings/model/profile-media.test.ts`
  - pass
  - crop output の AVIF 維持と AVIF -> PNG fallback の双方を回帰化
- `cd typescript && npm run typecheck`
  - pass
- `make rust-lint`
  - pass
- `make validate`
  - pass
  - TypeScript / Rust / Python validate まで完走
- `git diff --check`
  - pass

## Review gate
- `reviewer`
  - pass
  - AVIF crop path の filename/MIME mismatch と `blob.type` fallback を修正後、blocking finding なし
- `reviewer_ui_guard`
  - pass
  - frontend UI-impact ありと判定
- `reviewer_ui`
  - no blocking findings
  - reviewer sandbox では `tsconfig.tsbuildinfo` / Vite temp file の `EPERM` で typecheck/test を再実行できなかったが、同じ worktree 上でこちらの `npm run typecheck` と `make validate` は通過済み
  - non-blocking として、real settings screen の AVIF full-flow integration test は未追加という指摘あり

## Runtime smoke
- skipped
- rationale:
  - live profile media issuance には `PROFILE_GCS_BUCKET` と signer credential (`GOOGLE_APPLICATION_CREDENTIALS` もしくは attached service account) が必要
  - この環境では該当 env が未設定で、runbook 上の live upload/download smoke を完走できない
  - 代替証跡として Rust/TypeScript の automated validation と contract/runbook 更新を採用

## Known issues / follow-ups
- `user-profile.test.tsx` は crop modal を mock しているため、real settings screen の AVIF crop -> upload full-flow は unit coverage 止まり。non-blocking follow-up とする。
- live GCS bucket / signer credential が用意できたら、runbook Procedure A に沿った upload/download runtime smoke を追加で回す。
