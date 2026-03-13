# Prompt

## Goals
- non-`v1` permission-snapshot route の AuthN/AuthZ 境界を監査観点で再確認する。
- snapshot 取得主体/対象 guild/channel が追跡できる監査ログを追加する。
- mixed v1/non-v1 状態の cutover 条件を文書へ固定する。

## Non-goals
- permission-snapshot の `v1` alias 追加。
- frontend ActionGuard の新規変更。
- AuthZ policy や snapshot response shape の変更。

## Deliverables
- permission-snapshot handler の監査ログ。
- audit/log helper と route 契約テスト。
- `docs/AUTHZ.md` / `docs/AUTHZ_API_MATRIX.md` / `docs/V1_TRACEABILITY.md` の更新。
- LIN-980 run memory。

## Done when
- [ ] permission-snapshot 取得時の AuthN/AuthZ 挙動が docs と tests で確認できる
- [ ] 監査ログに principal/guild/channel scope が残る
- [ ] non-`v1` path 維持理由と cutover 条件が文書化される

## Constraints
- backend response contract は変えない。
- 監査ログ項目は既存 structured log 命名に合わせる。
