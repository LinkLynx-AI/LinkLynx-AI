# LIN-894 Documentation Log

## Current status
- Now: parent run 台帳を child issue 実態に合わせて補正中
- Next: `LIN-928` の証跡を親台帳へ寄せ、`LIN-929` 着手条件を明確化する

## Decisions
- `LIN-894` は parent issue として扱う
- child issue の実行順は `LIN-927` -> `LIN-928` -> `LIN-929`
- BAN は対象外
- report state は `open` / `resolved` を維持する
- branch は `codex/lin-894` をそのまま使う
- `/guilds/{guild_id}/moderation/reports` の `POST` は guild member の report 作成として `Guild + View` を使う
- moderation queue / detail / mute / resolve / reopen は `Guild + Manage` を使う
- Postgres moderation service の moderator 判定は `owner/admin` 直参照ではなく authorizer の `Guild + Manage` に揃える
- 既存 moderation UI は維持し、今回は regression test の補強で queue/detail/action 導線を固定する
- parent branch の受け入れ証跡は child issue ごとの責務を崩さない形で記録する

## How to run / demo
1. `cd rust && cargo test -p linklynx_backend moderation -- --nocapture`
2. `cd typescript && npm run typecheck`
3. `cd typescript && pnpm test -- --run moderation`
4. `make -C python validate`
5. moderator で `/channels/<serverId>/moderation` を開き、queue から detail へ遷移する
6. `resolve` / `reopen` / `mute` を実行する
7. 非 moderator で moderation queue/detail が fail-close することを確認する

## Known issues / follow-ups
- `LIN-927`: Done。DB/contract baseline は完了済み前提で扱う
- `LIN-928`: In Progress。report queue/list/detail API と関連 AuthZ/test 差分が親ブランチへ反映されている
- `LIN-929`: Todo。最小運用導線の最終整理は未完了
- `pnpm install` と `make -C python setup` により frontend / python validation 前提を復旧した
- `cargo test -p linklynx_backend moderation -- --nocapture`: pass
- `cd typescript && npm run typecheck`: pass
- `cd typescript && pnpm test -- --run moderation`: sandbox では `.vite-temp` 作成が `EPERM` で失敗するため、書き込み許可付き環境で再確認が必要
- `make -C python validate`: pass
- `make validate` は Python venv 作成後に再実行し formatter / python validate までは確認できたが、この環境では unified 実行の最終完了行を取得できなかった
- review gate:
  - `reviewer`: agent run was interrupted before a final result was captured
  - `reviewer_ui_guard`: test-only TypeScript diff のため production UI review は不要と判断
