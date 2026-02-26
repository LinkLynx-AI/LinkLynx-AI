# LIN-588 Postgres運用基準（migration単方向 / pool枯渇対策 / PITR要件）

## 目的

- 対象Issue: LIN-588
- PostgresをメタSoRとして扱うための運用基準を固定する。
- LIN-597（DR v0 runbook）へ接続できる前提を整備する。

本契約の対象:

- migrationの運用原則（forward-only）
- connection pool枯渇の予防・検知・緩和・復旧判定
- 単一AZ障害時の継続方針
- PITR目標値とrunbook参照

本契約の非対象:

- アプリケーション機能実装
- DBスキーマ変更
- ベンダー固有の復元実装詳細（Cloud SQL/Auroraなど）

## 参照

- `docs/DATABASE.md`
- `docs/runbooks/postgres-pitr-runbook.md`
- `docs/adr/ADR-002-class-ab-event-classification-and-delivery-boundary.md`
- `LIN-597`（DR v0）

## 1. Migration運用（forward-only）

### 1.1 正の定義

- PostgreSQLスキーマ変更の正は `database/postgres/migrations` のみとする。
- `database/postgres/schema.sql` は派生スナップショットとして扱う。

### 1.2 変更原則

- migrationは追記のみ（新規番号追加）を原則とする。
- 既存migrationファイルの編集は禁止する。
- 本番障害復旧は「補正forward migration」で実施する。

### 1.3 環境別ルール

| 環境 | `make db-migrate` | `make db-migrate-revert` | 復旧方針 |
| --- | --- | --- | --- |
| prod | 許可 | 禁止 | アプリ切り戻し + 補正forward migration |
| staging | 許可 | 検証用途のみ許可 | prod同等運用の検証を優先 |
| dev | 許可 | 検証用途のみ許可 | 学習/検証目的での利用のみ |

### 1.4 標準手順（事前確認 -> 適用 -> 事後確認）

1. 事前確認:
- 適用対象migrationを確認する。
- 差分と影響範囲（DDL/データ変換有無）をレビューする。
2. 適用:
- `make db-migrate`
3. 事後確認:
- `make db-migrate-info`
- 必要時に `make db-schema-check`

## 2. Connection pool枯渇対策

### 2.1 容量予算式

- `reserved_admin_connections = max(5, ceil(max_connections * 0.1))`
- `usable_connections = max_connections - reserved_admin_connections`
- `total_app_pool_max <= floor(usable_connections * 0.8)`

丸め規則:

- `ceil`: 小数点切り上げ
- `floor`: 小数点切り捨て

### 2.2 監視指標（必須）

- `pool_in_use_ratio`
- `pool_acquire_p95_ms`
- `pool_acquire_timeout_total`

### 2.3 閾値

- Warning:
  - `pool_in_use_ratio >= 0.80` が5分継続
  - または `pool_acquire_p95_ms >= 100` が5分継続
- Critical:
  - `pool_in_use_ratio >= 0.90` が2分継続
  - または `pool_acquire_timeout_total > 0` を1分窓で検知

### 2.4 緩和フロー（優先順）

1. 書き込み系バックプレッシャを有効化し、新規重い処理を抑制する。
2. 接続消費が大きいバッチ/管理処理を停止する。
3. アプリ側pool設定を見直し、同時実行数を引き下げる。
4. 影響範囲と暫定対応をインシデント記録へ残す。

### 2.5 復旧判定

次を10分継続で満たした場合に復旧と判定する。

- `pool_in_use_ratio < 0.70`
- `pool_acquire_p95_ms < 50`
- `pool_acquire_timeout_total = 0`

## 3. 単一AZ障害時の継続方針

### 3.1 開始条件

- Postgresへの到達不可または接続失敗が継続し、通常フェイルオーバで解消しない。

### 3.2 継続時ルール

- Postgres依存で整合性が必須な処理は `unavailable` として扱う。
- 継続可能な非依存経路は継続する。
- 整合性を壊す推測書き込み（未確定成功扱い、補償なし更新）は禁止する。

### 3.3 復旧時ルール

1. migration整合を確認する（適用状態の差異がないこと）。
2. 基本健全性（接続、主要クエリ応答）を確認する。
3. 読み取り中心 -> 書き込みの順で段階復帰する。

### 3.4 ADR整合

- Class A/Bの障害時挙動判断は ADR-002 をSSOTとして参照する。

## 4. PITR要件

- 暫定目標: `RPO 15分 / RTO 1時間`
- PITR手順の正は `docs/runbooks/postgres-pitr-runbook.md` とする。
- runbookには開始条件、完了条件、演習チェックリスト、演習記録テンプレートを含める。

## 5. 検証観点（レビュー手順）

1. 文書のみでforward-only運用を再現できること。
2. pool閾値到達時の検知・緩和・復旧判定を追跡できること。
3. 単一AZ障害時の継続境界が曖昧語なしで判定できること。
4. PITR runbookに開始条件/完了条件が明記されていること。

