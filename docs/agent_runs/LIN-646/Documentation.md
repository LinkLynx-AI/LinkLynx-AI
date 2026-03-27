# Documentation.md (Status / audit log)

## Current status
- Now:
  - M1/M2 の実装、targeted test、TypeScript typecheck、Rust strict gate まで完了した。
  - parent issue 向けの handoff と PR ドラフトを用意できる状態にした。
  - PR `#1262` を `main` 向けに作成した。
- Next:
  - Firebase / API 接続先が揃う環境で `full-discord-flow` の live smoke を実行する。
  - `make validate` を Python `pip` が入った環境で再実行する。

## Decisions
- `LIN-646` は残タスク親として扱い、既存 parent issue の再分解はしない。
- settings/channel 管理 UI は実APIで成立する面だけを残す。
- message attachment upload は別機能として扱い、本 issue には含めない。
- `auth-e2e-smoke` は既存 mode を維持したまま `full-discord-flow` を追加し、guild fixture を持たない自己完結フローにする。
- event schema / public runtime API の変更は含まれないため、ADR-001 compatibility checklist は `N/A` とする。

## Validation log
- 2026-03-27: `cd typescript && npm run test -- src/features/settings/ui/settings-layout.test.tsx src/features/settings/ui/server/server-overview.test.tsx src/features/settings/ui/server/server-invites.test.tsx src/features/modals/ui/channel-edit-invites.test.tsx src/features/modals/ui/channel-edit-modal.test.tsx scripts/auth-e2e-smoke.test.mjs` 成功（6 files / 22 tests）
- 2026-03-27: `cd typescript && npm run typecheck` 成功
- 2026-03-27: `cd typescript && node --check scripts/auth-e2e-smoke.mjs` 成功
- 2026-03-27: `make rust-lint` 成功
- 2026-03-27: `make validate` 失敗
  - failure: `/usr/bin/python3.10: No module named pip`
  - note: frontend prettier / Rust formatting までは進み、停止要因は Python toolchain 不備だった

## Review / UI gate
- reviewer: 未実施
  - この turn では sub-agent reviewer を起動していないため、manual handoff 用の evidence のみ残す。
- UI gate: manual self-review fallback
  - settings server navigation から未接続タブが外れていることを test で固定した。
  - server overview は guild name update / delete 以外の編集 UI を露出しないことを test で固定した。
  - channel edit modal は `overview` / `invites` のみであることを test で固定した。

## Manual sync note
- child issue 運用に合わせる場合は、今回の diff を以下 2 本へ分割して転記する。
  - child 01: settings/channel 管理 UI の整列 + invite error 表示統一
  - child 02: `auth-e2e-smoke` `full-discord-flow` + runbook 更新
- 現在の branch `codex/lin-646` は parent 残タスクの統合差分として扱っている。

## PR handoff
- branch: `codex/lin-646`
- suggested PR title: `LIN-646 v1 Discord 残タスクの UI 整列と full smoke を追加`
- PR body draft: `docs/agent_runs/LIN-646/PR.md` を参照
- PR: `https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1262`

## How to run / demo
- `cd typescript && npm run test -- src/features/settings/ui/settings-layout.test.tsx src/features/settings/ui/server/server-overview.test.tsx src/features/settings/ui/server/server-invites.test.tsx src/features/modals/ui/channel-edit-invites.test.tsx`
- `cd typescript && npm run test -- src/features/modals/ui/channel-edit-modal.test.tsx scripts/auth-e2e-smoke.test.mjs`
- `cd typescript && npm run typecheck`
- `cd typescript && npm run smoke:auth -- --mode=full-discord-flow`
- `make rust-lint`

## Known issues / follow-ups
- live smoke は local runtime / Firebase test user が必要。
- frontend validation には `typescript/node_modules` が必要だったため、ローカル install 後に test / typecheck を実行した。
- `make validate` は Python formatting step の `/usr/bin/python3.10: No module named pip` で停止した。frontend prettier と Rust formatting は通過しており、失敗は今回変更箇所由来ではない。
- `make -C python setup` も `python3.10 -m venv .venv` で停止し、原因は `ensurepip` 不足だった。
- `.env` の Firebase 設定は placeholder (`your-firebase-project-id` / `replace-with-your-firebase-web-api-key` など) のままで、現環境では `full-discord-flow` の live smoke を実行できない。
