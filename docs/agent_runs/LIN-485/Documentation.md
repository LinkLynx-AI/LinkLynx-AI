# LIN-485 Documentation

## Status
- Started: 2026-02-28
- Current: implemented (validated)

## Decisions
- 実装順序は LIN-517 -> LIN-518 -> LIN-516 -> LIN-523。
- 招待復帰導線のクエリ契約は `redirect` を採用。
- UI見た目は `designs/discord-unified.pen` の Screen/Component を一次参照にする。
- `reviewer` 系エージェントが実行環境で利用不可だったため、`lint/typecheck/test + make validate + make rust-lint + 手動差分レビュー` をゲート代替とした。

## Child Issue Evidence

### LIN-517
- Branch: `codex/lin-485-feat-ui_main` (local implementation)
- Implemented:
  - 左カラムUI（server rail / channel-dm list / member list）を `widgets` に分離
  - unread/hover/selected/muted/presence 表現を追加
- Validation:
  - `cd typescript && npm run lint`: passed
  - `cd typescript && npm run typecheck`: passed
  - `cd typescript && npm run test`: passed
  - `make validate`: passed
  - `make rust-lint`: passed
- Reviewer gate: `reviewer unavailable` -> manual review passed (`P1+` none)
- UI gate: manual (`true`, UI変更あり)
- PR: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/733

### LIN-518
- Branch: `codex/lin-485-feat-ui_main` (local implementation)
- Implemented:
  - 会話UI（header + timeline + composer）を `widgets` に追加
  - channels/me と channels/[guildId]/[channelId] で共通描画
- Validation:
  - `cd typescript && npm run lint`: passed
  - `cd typescript && npm run typecheck`: passed
  - `cd typescript && npm run test`: passed
  - `make validate`: passed
  - `make rust-lint`: passed
- Reviewer gate: `reviewer unavailable` -> manual review passed (`P1+` none)
- UI gate: manual (`true`, UI変更あり)
- PR: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/733

### LIN-516
- Branch: `codex/lin-485-feat-ui_main` (local implementation)
- Implemented:
  - `/invite/[code]` を valid/invalid/expired の3状態表示へ拡張
  - `buildLoginRoute` を追加し、`/login?redirect=<invite>` 復帰導線を実装
- Validation:
  - `cd typescript && npm run lint`: passed
  - `cd typescript && npm run typecheck`: passed
  - `cd typescript && npm run test`: passed
  - `make validate`: passed
  - `make rust-lint`: passed
- Reviewer gate: `reviewer unavailable` -> manual review passed (`P1+` none)
- UI gate: manual (`true`, UI変更あり)
- PR: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/733

### LIN-523
- Branch: `codex/lin-485-feat-ui_main` (local implementation)
- Implemented:
  - pending/failed/retry/jump/edit/delete の状態・操作UIを timeline 上で表現
  - state badge + hover action bar を追加
- Validation:
  - `cd typescript && npm run lint`: passed
  - `cd typescript && npm run typecheck`: passed
  - `cd typescript && npm run test`: passed
  - `make validate`: passed
  - `make rust-lint`: passed
- Reviewer gate: `reviewer unavailable` -> manual review passed (`P1+` none)
- UI gate: manual (`true`, UI変更あり)
- PR: https://github.com/LinkLynx-AI/LinkLynx-AI/pull/733

## Notes
- ローカル環境の Node は `v22.4.0` で、一部依存の `engines` 警告（`v22.12.0` 以上推奨）が出るが、lint/typecheck/test は通過している。
- PR #733 は `main` 向けのため、運用ルールどおり auto-merge は有効化せず人手レビュー待ち。
