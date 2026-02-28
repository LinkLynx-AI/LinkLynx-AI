# LIN-622 Prompt

## Goal
- `uid -> principal_id` 未解決時に初回認証で principal を冪等自動プロビジョニングする。
- 競合時は upsert/再解決で収束し、解消不能競合は fail-close (`403`) で拒否する。
- 失敗分類を認証エラー契約 (`401/403/503`) に正しくマッピングする。

## Non-goals
- AuthZ 実装の追加/変更。
- 認証プロバイダ追加。
- 認証ミドルウェアへのドメインロジック混入。

## Done conditions
- 初回認証で `auth_identities` が冪等作成される。
- 重複/競合/障害シナリオのテストが追加され、既存 mapping の回帰がない。
- 監査ログとメトリクス（成功/失敗/再試行）が出力される。
- `docs/DATABASE.md` と認証 runbook の契約記述が実装と一致する。
