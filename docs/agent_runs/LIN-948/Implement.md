# Implement

- durable idempotency は `Idempotency-Key` 指定時だけ有効化し、未指定時は通常 create とする。
- `request_id` は observability 用に残し、message identity の再利用には使わない。
- Postgres durable reservation -> Scylla append -> `channel_last_message` upsert -> completion update の順序を固定する。
- completion 更新に失敗した場合は `reserved` のまま残し、後続 retry が同じ identity で再実行できるようにする。
- payload 比較は raw body ではなく `CreateGuildChannelMessageRequestV1` の canonical JSON fingerprint で判定する。
- `completed` 状態の replay では Scylla 追加書き込みを行わず、保存済み identity をそのまま返す。
- `RuntimeMessageService` を別 instance で生成しても、shared idempotency state が同じ response identity を返す回帰テストを追加した。
- validation / review / runtime smoke の結果は `Documentation.md` に追記する。
