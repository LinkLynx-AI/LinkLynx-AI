# LIN-287 Scylla 履歴主キー設計 適合確認

## 目的

- 対象 Issue: LIN-287
- 対象: `database/scylla/001_lin139_messages.cql`
- 判定対象: 履歴取得要件に対する partition key / clustering key の適合性

## 履歴取得要件（LIN-287）

- チャンネル履歴取得に最適化した主キー構成であること
- カーソル走査（`message_id` 基準）に利用できること

## 検証対象 DDL

`chat.messages_by_channel`

- PRIMARY KEY: `((channel_id, bucket), message_id)`
- CLUSTERING ORDER: `(message_id DESC)`

## 要件適合の判定

1. `channel_id` を先頭に含む partition key により、チャンネル単位の履歴参照が可能
2. `bucket` を partition key に含めることで、単一パーティション肥大化を抑制できる
3. `message_id` を clustering key + `DESC` にしているため、新しい履歴からのページングに適合
4. `message_id < :cursor` 条件で同一パーティション内の後続ページ走査が可能

判定: **適合（不足なし）**

## 補正 migration 要否

- `database/scylla/002_lin287_history_primary_key_adjustment.cql` は **不要**
- 理由: LIN-287 が求める主キー/クラスタ順は `001_lin139_messages.cql` で既に満たされており、破壊的変更や追加 DDL は不要

## 検証ログ（コマンド）

```bash
rg -n "CREATE TABLE|PRIMARY KEY|CLUSTERING ORDER" database/scylla/001_lin139_messages.cql
```

上記で `messages_by_channel` の主キーとクラスタ順を確認済み。
