# Invite Issuance Implement

- 招待は既存 schema の `invites.guild_id` を使う guild-scope invite として発行する。
- 発行元 channel は request validation と UI 表示に使い、今回の差分では DB 永続化しない。
- invite ID は競合回避のため sequence を追加して採番する。
- frontend は server context と channel context の両方から modal を開けるようにする。
- 実装中の判断と検証は `Documentation.md` へ追記する。
