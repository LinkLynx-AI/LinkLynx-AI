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

### Class A/B 運用参照（LIN-581）

- 配信イベントの Class A/B 分類、NATS障害時の期待挙動、再取得要否は
  `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md` を単一SSOTとして扱う。
- Consumer実装・運用手順の追加時は、イベント定義ごとに Class と復旧経路をADR-002と整合させる。

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

### v1 Event Stream 拡張（LIN-601）

- v0 の最小契約（GCP Pub/Sub中心）を維持したまま、v1 では Redpanda を拡張ストリーム経路として扱う。
- Redpanda の topic naming / retention / replay / outage 運用は以下をSSOTとする。
  - `database/contracts/lin601_redpanda_event_stream_baseline.md`
  - `docs/runbooks/redpanda-topic-retention-replay-runbook.md`
- ADR-002 の境界に従い、Class A の主耐久責務は JetStream 側に残し、Redpanda を SoR に昇格させない。

## 3. Redis レート制限（RateLimit）L2 契約

- L1: 各ノードのローカルメモリ GCRA/TAT
- L2: 必要時のみ Redis フォールバックを使う

### Dragonfly障害時フェイル方針（ADR-005）

- 参照: `docs/adr/ADR-005-dragonfly-ratelimit-failure-policy.md`
- Dragonfly（Redis互換L2）障害時はハイブリッド方針を適用する。
  - 高リスク操作（認証試行、招待悪用対策、アカウント保護系）は `fail-close`
  - 継続性重視の主要書き込み/読み取り・セッション継続は `degraded fail-open`（L1判定のみ継続）
- Degraded移行条件:
  - healthcheck連続失敗（約30秒）または L2 エラー率 `>= 20%`（1分窓）
- Degraded解除条件:
  - 10分連続健全 かつ L2 エラー率 `< 1%`
- 復旧後は全量再計算を行わず、既存の `SET ... NX EX` ベース再構築手順を継続しつつ10分ウォームアップ監視を実施する。

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

## 4. Session/Resume（Dragonfly）実行時契約（LIN-587）

- session/resume 契約のSSOTは `database/contracts/lin587_session_resume_runtime_contract.md` を参照する。
- Dragonfly の session 状態は揮発ストアとして扱い、永続SoRとしては扱わない。
- 固定基準:
  - `session TTL = 180s`
  - `heartbeat interval = 30s`
  - `liveness timeout = 90s`
- state model:
  - `active`
  - `resumable`
  - `expired`
- Dragonflyキー:
  - `sess:v0:{session_id}`
  - 必須保持項目: `principal_id`, `issued_at`, `expires_at`, `last_heartbeat_at`, `last_disconnect_at`, `resume_nonce`
- resume 失敗時は `full re-auth + History API再取得誘導` を固定フォールバックとする。
- Dragonfly障害時は ADR-005 の `Read/session continuity` に従い `degraded fail-open`（継続性優先、品質低下許容）を適用する。
