# Rust バックエンド規約

## 0. このドキュメントの目的
- 単一デプロイ開始から将来の高負荷分離（`gateway`/`message`）まで、設計を崩さず拡張できる実装ルールを固定する
- 可読性・保守性・スケール（人数/機能増）に耐える一貫ルールを提供する
- 自動化できるものは自動化（`fmt`/`clippy`/`test`）し、人間判断が必要なものだけを規約化する

## 1. ルールの優先順位（衝突時）
1. Compiler（`cargo check` / `cargo test`）
2. Clippy（`-D warnings`）
3. Rustfmt
4. 本ドキュメント（`AGENT.md`）

## 2. 絶対ルール（Non-Negotiables）
- `apps/*` は薄く保つ（ルーティング・DTO変換・DI配線のみ）。業務ロジックは禁止。
- 各ドメインcrateは `src/{domain,usecase,ports}` を維持する。
- `platform/*` はドメイン別サブディレクトリで分割し、単一巨大crate/巨大モジュール化を禁止する。
- リアルタイム配信契約は `crates/contracts/protocol-events` に集約する。
- `crates/contracts/message-api` は command/query 契約に限定する。
- `unwrap`/`expect` はテストとプロセス起動直後の不可避箇所のみ許可し、業務ロジックでは禁止。
- `tokio` 非同期コンテキストでブロッキングI/Oを直接実行しない（必要なら `spawn_blocking` を使う）。

## 3. ディレクトリ規約（採用構成）
```text
rust/
├─ apps/
│  ├─ api/                       # HTTP/WS入口（薄い）
│  └─ worker/                    # 非同期job実行
├─ crates/
│  ├─ contracts/
│  │  ├─ ids/
│  │  ├─ protocol-ws/
│  │  ├─ protocol-events/        # MESSAGE_*/GUILD_*/ROLE_*/INVITE_*/PRESENCE_*/MODERATION_*
│  │  └─ message-api/            # command/query 契約
│  ├─ gateway/                   # realtime配信ユースケース
│  ├─ domains/
│  │  └─ <domain>/src/{domain,usecase,ports}
│  ├─ platform/
│  │  ├─ postgres/<domain>/
│  │  ├─ scylla/message/
│  │  ├─ redis/{presence,ratelimit}/
│  │  ├─ pubsub/{producer,consumer}/
│  │  ├─ search/indexer/
│  │  └─ email/auth/
│  └─ shared/{config,telemetry,errors}
└─ tests/{contract,integration}
```

## 4. 依存方向ルール
- 依存方向は `apps -> gateway/domains/contracts/shared` のみ。
- `domains/*` は `contracts/*` と `shared/*` に依存できるが、`platform/*` に依存してはならない。
- `platform/*` は `domains/*/ports` の実装を提供する層とする。
- ドメイン間の直接依存は避け、必要な連携は `ports` か `contracts` を介す。

## 5. 契約（Contracts）ルール
- 配信イベント（WebSocket fanout対象）は `protocol-events` を単一の正とする。
- `protocol-events` の破壊的変更は禁止。追加時は後方互換（optional field追加）を優先する。
- `message-api` は「操作要求と問い合わせ」の境界契約。配信イベントを重複定義しない。
- ID型（`UserId`/`GuildId`等）は `contracts/ids` で統一し、プリミティブ型の裸利用を避ける。

## 6. DB/非同期運用ルール（実装時必須）
- メッセージ本文は Scylla、DMメタ/一意性は Postgres（`dm_pairs`）を前提にする。
- 既読更新は単調増加契約を守る（逆行更新禁止）。
- 非同期配信は outbox + idempotent consumer を前提に設計する。
- Search反映は versionガード前提で古いイベントを適用しない。
- RateLimit は L1（ローカルGCRA）主経路、L2（Redis）は fallback/安全弁として扱う。

## 7. 実装規約
- 1 usecase = 1 file を原則にする。
- `domain` はI/Oを持たない純ロジックに限定する。
- `usecase` は入出力契約・トランザクション境界・ユースケースオーケストレーションを担当する。
- `ports` はtraitで定義し、外部I/O実装は `platform` 側へ置く。
- 公開APIは `mod.rs`（またはlib.rs）で明示し、不要な `pub` を避ける。

## 8. コメント規約
- 「何をするか」ではなく「なぜそうするか」を書く。
- TODO/FIXME にはチケットIDを必須化する（例: `TODO(LIN-151): ...`）。
- 仕様依存の判断には根拠（Issue/契約）を短く添える。

## 9. テスト規約
- `domain`: 純ロジックの unit test を最優先。
- `usecase`: portをモックした振る舞いテストを実装する。
- `contracts`: `protocol-events`/`message-api` の互換性テストを置く。
- `integration`: Postgres/Scylla/PubSub/Redis 境界の往復を検証する。

## 10. 自動検査コマンド
- `make rust-fmt`
- `make rust-clippy`
- `make rust-test`
- `make rust-lint`（`fmt --check` + `clippy -D warnings` + `cargo test`）

## 11. レビューで落とすアンチパターン
- `apps` 層への業務ロジック混入
- `domains` から `platform` への直接依存
- `protocol-events` を経由しない独自イベント契約の乱立
- `platform/postgres` 直下への無秩序なrepo追加（ドメイン分割なし）
- 理由のない `unwrap`/`expect`/`clone`
