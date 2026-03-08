# Documentation.md (Status / audit log)

## Current status
- Now: stacked PR 作成済み。残りは PR merge 待ちのみ。
- Next: parent issue 側の残タスク確認。

## Decisions
- `returnTo` は protected-only のまま維持し、invite 専用 resume 情報は別 query で扱う方針を優先する。
- invite join 自体は LIN-912 backend を利用し、frontend では CTA / auto-resume / redirect を閉じる。
- login / verify-email 経由の復帰先は `/invite/{code}?autoJoin=1` に固定し、復帰後は client wrapper が join 成功時に `/channels/{guildId}` へ遷移させる。
- invite page の valid state は auth session に応じて `ログインして参加` / `メール確認して参加` / `サーバーに参加` を切り替える。

## Known issues / follow-ups
- PR: `https://github.com/LinkLynx-AI/LinkLynx-AI/pull/1135`
- TypeScript test の `act(...)` warning と verify-email の想定 error log は既存ノイズとして継続。
