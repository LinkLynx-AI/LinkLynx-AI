# LIN-139 実行時契約（検索 / PubSub / Redis）

この文書は、DB選定前提を満たすために必要な実行時契約を定義します。
LIN-139 のスコープに含め、スキーマ実装とセットで適用します。

## 1. 検索（Search）契約

- エンジン: Elastic Cloud on GCP（第一候補）、OpenSearch on GKE（代替）
- インデックス名: `messages`
- ドキュメントID: `message_id`
- 必須フィールド:
  - `guild_id`（DMでは `null` 許容）
  - `channel_id`
  - `author_id`
  - `bucket`
  - `content`
  - `created_at`
  - `is_deleted`
  - `version`

### バージョンガード規約

- 更新は原子的に実行すること
- `incoming.version <= stored.version` のイベントは反映しないこと
- アプリケーション側の read-compare-write 実装は禁止

### 実装方式（必須）

- Elasticsearch / OpenSearch ともに、ドキュメント更新は `version_type=external` を使う
- `version` には Pub/Sub の `message.version` をそのまま使う
- 具体例:
  - `PUT /messages/_doc/{message_id}?version={incoming.version}&version_type=external`
  - 競合（`version_conflict_engine_exception`）は「古いイベント」として握り潰す
- `MessageDeleted` も同一方式で `is_deleted=true` のトゥームストーン更新を行う

### マッピング例（最小）

```json
{
  "mappings": {
    "properties": {
      "guild_id": { "type": "long" },
      "channel_id": { "type": "long" },
      "author_id": { "type": "long" },
      "bucket": { "type": "integer" },
      "content": { "type": "text" },
      "created_at": { "type": "date" },
      "is_deleted": { "type": "boolean" },
      "version": { "type": "long" }
    }
  }
}
```

## 2. Pub/Sub 契約

- 伝送基盤: GCP Pub/Sub（DLQ有効）
- 順序キー: `channel:{channel_id}`
- イベント種別: `MessageCreated` / `MessageUpdated` / `MessageDeleted`

### ペイロードスキーマ

```json
{
  "event_id": "snowflake",
  "type": "MessageUpdated",
  "occurred_at": "2026-02-18T15:00:00Z",
  "ordering_key": "channel:456",
  "message": {
    "message_id": 123,
    "channel_id": 456,
    "guild_id": 789,
    "author_id": 111,
    "bucket": 999,
    "version": 2,
    "content": "編集後テキスト",
    "is_deleted": false
  }
}
```

### 配信 / 再試行ルール

- 購読側ロジックは `event_id` もしくは `message_id + version` で冪等にすること
- DLQ からの再試行時も順序キーを維持すること
- `MessageDeleted` はトゥームストーン（`is_deleted=true`）としてインデックス更新すること

## 3. Redis レート制限（RateLimit）L2 契約

- L1: 各ノードのローカルメモリ GCRA/TAT
- L2: 必要時のみ Redis フォールバックを使う
- 必須キー:
  - `rl2:gcra:user:{user_id}:{action}`
  - `rl2:gcra:ip:{ip}:{action}`
- 値形式: 整数の `tat_ms`
- TTL: 数分（デフォルト `300` 秒）

### TTL 失効時の扱い

- TTL切れでキーが消えていた場合は「L2の状態なし」として扱う
- ただし burst 過多を防ぐため、L2ミス時は次の順で処理する:
  1. まず L1 判定結果を使う
  2. L2 に `SET ... NX EX 300` で `tat_ms=max(now_ms, l1_tat_ms)` を初期化する
  3. `SET NX` が負けた場合のみ `GET` 再読込して再判定する
- これにより、TTL失効/再起動直後でも多重ノードでの過剰許可を最小化する

### L2 参照条件

- 閾値境界付近の判定時
- 疑わしいアクセスパターン検知時
- 重要操作の判定時
- ノード再起動 / リバランス直後
- L1 状態キャッシュミス時
