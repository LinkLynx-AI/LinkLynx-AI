# PostgreSQL PITR Runbook（Draft）

- Status: Draft
- Last updated: 2026-02-26
- Owner scope: Postgres運用（v0 baseline）
- References:
  - `database/contracts/lin588_postgres_operations_baseline.md`
  - `docs/DATABASE.md`
  - `LIN-588`
  - `LIN-597`

## 1. 目的とスコープ

このrunbookは、Postgres障害時にPoint-In-Time Recovery（PITR）を開始し、検証してサービス再開するまでの判断基準と実行手順を定義する。

In scope:

- PITR開始判断
- 復旧時刻の決定
- 復元・検証・再開の標準手順
- 演習（机上）チェックリストと記録テンプレート

Out of scope:

- ベンダー固有のオペレーション詳細
- 本番自動復旧システム実装
- v1高度DR運用

## 2. 目標値

- `RPO 15分`
- `RTO 1時間`

定義:

- RPO: 許容データ損失の上限（復旧時点と障害時点の差）
- RTO: 障害検知から業務再開までの許容時間

## 3. PITR開始条件

次を満たす場合にPITR開始候補とする。

1. Postgresが継続的に到達不能、または通常フェイルオーバで回復しない。
2. 整合性を保証した通常書き込み再開の見込みがない。
3. 影響範囲（対象環境・時刻・主要機能）を特定できる。

開始しない条件:

- 障害が一時的で、通常復旧でRTO内に回復可能な場合
- 復元元データ（backup/WAL等）の整合が未確認な場合

## 4. 開始判断（Start decision）

開始判定は次の両方を満たしたときに実施する。

1. セクション3の開始条件を満たす。
2. 復旧責任者と判定責任者を明確化済み。

判定後は、開始時刻・想定復旧時刻・対象復旧時点（target timestamp）をインシデント記録へ残す。

## 5. 実行手順

### 5.1 復旧時点（target timestamp）決定

1. 障害発生時刻と異常書き込み区間を特定する。
2. 最小損失で整合が保てる時点を選ぶ。
3. 想定RPO（15分以内）に収まるかを確認する。

### 5.2 復元実行

1. 書き込み経路を停止またはメンテナンスモードにする。
2. 復元先インスタンスを準備する。
3. 取得済みバックアップとログを使ってtarget timestampへ復元する。
4. 復元後インスタンスで基本健全性を確認する。

### 5.3 データ/契約整合確認

1. migration適用状態を確認する（差分なし）。
2. 主要テーブルの読取り確認を行う。
3. 必須機能に関わるクエリの疎通を確認する。

### 5.4 サービス再開

1. 読み取り系を先に再開する。
2. 問題がなければ書き込み系を段階的に再開する。
3. 再開後は監視を強化し、RTO内の完全復帰可否を判定する。

## 6. 完了条件（Close decision）

次をすべて満たした場合にPITR完了とする。

1. Postgres主要機能が正常応答する。
2. migration整合と基本データ整合が確認済み。
3. 読み取り/書き込みの段階復帰が完了している。
4. 影響範囲、損失範囲、RPO/RTO実績を記録済み。

## 7. エスカレーション条件

以下の場合は即時エスカレーションする。

- RPO 15分を超える損失が見込まれる。
- RTO 1時間以内の復帰見込みが立たない。
- 復元元データの欠損や破損が疑われる。
- migration整合が復元後に一致しない。

## 8. 机上演習チェックリスト

1. 障害シナリオ（単一AZ障害）を定義したか。
2. 開始条件と開始判定を文書のみで実行できるか。
3. target timestamp決定の根拠を示せるか。
4. 完了条件を満たしたかを客観的に判定できるか。
5. 改善項目をLIN-597へ連携できる形式で記録したか。

## 9. 演習記録テンプレート

```markdown
### Postgres PITR Drill Record

- Date:
- Environment:
- Scenario:
- Detected at:
- PITR start at:
- Target timestamp:
- Service resume at:
- RPO result:
- RTO result:
- Data loss summary:
- Validation summary:
- Open risks:
- Follow-up issues:
```

