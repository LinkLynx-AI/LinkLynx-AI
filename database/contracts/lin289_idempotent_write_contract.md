# LIN-289 `message_id` 冪等保存契約

## 目的

- 同一 `message_id` の二重保存を防止する。
- 再送 / 再接続時も同じ手順で安全に再実行できる保存規約を定義する。
- `IF NOT EXISTS` を使った duplicate no-op の期待結果を再現可能にする。

## 対象 / 非対象

- 対象: `chat.messages_by_channel` への新規メッセージ保存（MessageCreated）
- 非対象: MessageUpdated / MessageDeleted、アプリケーション実装、既存スキーマ変更

## 事前条件

1. `message_id` はメッセージ作成ごとに一意である。
2. `bucket` 算出は決定的であり、同一 `message_id` から同一 `bucket` が得られる。
3. 保存時の整合性レベルは `LOCAL_QUORUM`、直列整合は `LOCAL_SERIAL` を推奨する。

## 保存契約（適用順序）

1. 入力から `bucket` を算出する。
2. `chat.messages_by_channel` に `INSERT ... IF NOT EXISTS` を実行する。
3. 応答の `[applied]` を評価する。
4. `[applied] = true` の場合は初回保存成功として扱う。
5. `[applied] = false` の場合は duplicate として no-op 成功として扱う。
6. ACK未達・タイムアウトで結果不確定の場合は `SELECT` で存在確認する。
7. 行が存在すれば成功終了、存在しなければ同じ値で `INSERT ... IF NOT EXISTS` を再実行する。

## duplicate no-op の期待結果

| シナリオ | `INSERT ... IF NOT EXISTS` の結果 | 期待結果 |
| --- | --- | --- |
| 初回保存 | `[applied] = true` | 1行作成される |
| 同一 payload を再送 | `[applied] = false` | 新規行は作成されない（no-op） |
| 結果不確定後の再試行（既存あり） | `[applied] = false` または事前 `SELECT` で検出 | 新規行は作成されない（no-op） |

## 検証手順

1. `database/scylla/queries/lin289_idempotent_write_strategy.cql` の検証シナリオを `cqlsh` で順に実行する。
2. 初回保存で `[applied] = true` を確認する。
3. 同一 `message_id` の再実行で `[applied] = false` を確認する。
4. `SELECT COUNT(*)` の結果が増加しないことを確認する（重複排除）。

## 判定基準

- 上記手順で duplicate 時に `[applied] = false` となり、行数が増えなければ LIN-289 の DB 契約を満たす。
- 本契約は「重複作成を防ぐ」ことを保証範囲とし、編集 / 削除イベントは別契約で扱う。
