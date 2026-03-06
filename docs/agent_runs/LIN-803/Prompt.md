# LIN-803 Prompt

## Goal
- `guilds / guild_members / channels` の現行契約を確認し、LIN-806 で再利用できる不足差分を migration で固定する。
- 最小スキーマ制約と一覧向けインデックスを明文化する。
- `docs/DATABASE.md` と DB 契約ドキュメントを更新する。

## Non-goals
- カテゴリ/スレッドの本実装。
- 招待/DM/メッセージ機能の混在。
- Backend API/Frontend導線の実装。

## Done conditions
- `0015_lin803_server_channel_minimal_contract` migration が追加されている。
- `docs/DATABASE.md` に LIN-803 差分が反映されている。
- LIN-806 受け渡し可能な DB 契約ドキュメントが追加されている。

## Traceability note
- Historical references to `0008_lin803_server_channel_minimal_contract` should be read as the same schema intent now stored under `0015_lin803_server_channel_minimal_contract`.
