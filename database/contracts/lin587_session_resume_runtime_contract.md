# LIN-587 Session/Resume Runtime Contract (Dragonfly)

## 目的

- 対象Issue: LIN-587
- v0 Gatewayの session/resume 継続性契約を固定し、LIN-593 以降の前提を明確化する。
- Dragonfly を揮発状態ストアとして使う範囲と制約を固定する。

## スコープ

In scope:

- Session状態モデル（`active` / `resumable` / `expired`）
- Dragonfly sessionキー命名、保持項目、TTL契約
- Resume成立条件と失敗時フォールバック
- Dragonfly障害時の劣化方針（ADR-005整合）
- 運用メトリクスと目標値

Out of scope:

- Rustランタイム実装変更
- Dragonfly永続化や永続SoR化
- v1向け高度セッション配布/再送制御

## 参照

- `docs/adr/ADR-005-dragonfly-ratelimit-failure-policy.md`
- `docs/runbooks/edge-rest-ws-routing-drain-runbook.md`
- `docs/runbooks/auth-firebase-principal-operations-runbook.md`
- `docs/runbooks/session-resume-dragonfly-operations-runbook.md`

## 1. Session状態モデル

| 状態 | 定義 | 継続条件 | 終了条件 |
| --- | --- | --- | --- |
| `active` | WS接続が生存し、heartbeatが liveness timeout 内で継続している状態 | `heartbeat interval = 30s` を満たし、`liveness timeout = 90s` を超えない | 明示切断、liveness timeout超過、認証失効、障害切断 |
| `resumable` | 接続は切れているが、resume条件を満たせる再開猶予状態 | sessionキーが存在し、`session TTL = 180s` 内 | TTL失効、principal不一致、認証失効 |
| `expired` | session再開不能状態 | なし | 新規セッション作成のみ可能 |

補足:

- Dragonflyは session の揮発状態ストアであり、永続SoRではない。
- sessionキー消失は `expired` 扱いとし、推測補完は行わない。

## 2. Dragonflyキー契約

### 2.1 キー形式

- 主キー: `sess:v0:{session_id}`
- TTL: `180` 秒（固定基準）

### 2.2 値スキーマ（必須項目）

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `principal_id` | integer | required | セッション主体の内部ID |
| `issued_at` | unix epoch seconds | required | セッション発行時刻 |
| `expires_at` | unix epoch seconds | required | `issued_at + 180` を基準にした有効期限 |
| `last_heartbeat_at` | unix epoch seconds | required | 最終heartbeat受信時刻 |
| `last_disconnect_at` | unix epoch seconds or null | required | 切断検知時刻（未切断時は null 可） |
| `resume_nonce` | opaque string | required | resume試行の再利用防止トークン |

### 2.3 更新ルール

1. 接続確立時:
- 新規 `session_id` を採番し、必須項目を保存する。
2. heartbeat受信時:
- `last_heartbeat_at` を更新し、TTLを `180s` に延長する。
3. 切断検知時:
- `last_disconnect_at` を更新し、キーはTTL満了まで保持する。
4. resume成功時:
- `resume_nonce` をローテーションし、`last_disconnect_at` を `null` に戻し、TTLを `180s` に再設定する。

## 3. Resume成立条件

Resumeは以下をすべて満たす場合のみ成立する:

1. `sess:v0:{session_id}` が存在する。
2. `expires_at` が現在時刻より後（TTL内）である。
3. 再接続主体の `principal_id` が保存値と一致する。
4. 認証状態が有効（LIN-586契約の fail-close 条件に反しない）。

判定順序（固定）:

1. sessionキー存在確認
2. TTL/期限確認
3. principal一致確認
4. 認証有効確認

## 4. Resume失敗時フォールバック契約

Resume不成立時は、理由に関わらず次を実行する:

1. full re-auth（新規接続時と同等の認証）
2. クライアントへ履歴再取得誘導
3. History API経由で欠落イベントを補償

代表的な失敗理由:

- `session_not_found`
- `session_expired`
- `principal_mismatch`
- `auth_unavailable_or_invalid`
- `dragonfly_unavailable`

## 5. Dragonfly障害時の劣化方針（ADR-005整合）

- session/resume/heartbeat は ADR-005 の `Read/session continuity` クラスとして扱う。
- Dragonfly障害時は `degraded fail-open` を適用する。

固定動作:

1. 新規接続は継続する（認証成功前提）。
2. resumeはベストエフォートとし、失敗時は即フォールバック（full re-auth + 履歴再取得）へ遷移する。
3. presence/session品質低下（再開成功率低下、再購読増加）は許容し、可用性を優先する。

## 6. メトリクス契約と目標値

必須メトリクス:

- `session_resume_attempt_total`
- `session_resume_success_total`
- `session_resume_fallback_total{reason}`
- `session_heartbeat_timeout_total`
- `session_dragonfly_unavailable_total`

指標:

- `resume_success_rate = session_resume_success_total / session_resume_attempt_total`

目標値:

- Dragonfly健全時・短時間切断シナリオで `resume_success_rate >= 95%`

## 7. TTL変更の運用契約

TTL変更は直接本番反映せず、次の順序で実施する:

1. staging
2. canary
3. full rollout

詳細手順とロールバック条件は
`docs/runbooks/session-resume-dragonfly-operations-runbook.md` をSSOTとする。

## 8. 検証観点

1. 短時間切断からの再接続で resume 成立手順を再現できる。
2. TTL満了時に resume不成立となり、再認証 + 履歴再取得に遷移する。
3. Dragonfly停止時に degraded fail-open と fallback方針が矛盾なく適用される。
4. 下流Issue（LIN-593）が追加仮定なしで本契約を参照できる。
