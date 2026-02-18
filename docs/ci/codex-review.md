# Codex 自動レビュー 運用手順書

## 概要

`main` ブランチへの Pull Request 作成・更新時に、OpenAI Codex（`codex-5.3`）を用いたコードレビューが自動実行されます。レビュー結果は PR コメントとして投稿されます。

## アーキテクチャ

```
PR 作成 / コミットプッシュ
        │
        ▼
GitHub Actions: codex-review.yml
        │
        ├─ git diff を取得 (pr.diff)
        │
        ├─ Codex API (Responses API) へ diff を送信
        │
        └─ GitHub API でレビューコメントを投稿
```

## セットアップ

### 1. シークレットの登録

GitHub リポジトリの **Settings > Secrets and variables > Actions** で以下を設定してください。

| シークレット名 | 説明 |
|---|---|
| `OPENAI_API_KEY` | OpenAI API キー（`sk-...`） |

`GITHUB_TOKEN` は GitHub Actions が自動で提供するため、設定不要です。

### 2. ワークフローの確認

`.github/workflows/codex-review.yml` がリポジトリに存在し、`main` ブランチにマージされていることを確認してください。

---

## 通常の運用フロー

1. `main` ブランチへの PR を作成（または新しいコミットをプッシュ）する
2. `Codex Code Review` ジョブが自動起動される
3. 数分後、PR に `🤖 Codex Auto Review` コメントが投稿される
4. コメント内容を参考にレビュー・修正を行う

> **注意**: 同一 PR への複数回プッシュは `concurrency` 設定により、直近のジョブのみ実行されます。

---

## 失敗時の対応手順

### ケース1: ワークフロー自体が失敗する

1. PR の **Checks** タブで失敗したジョブを確認する
2. ログから原因を特定する

   | エラーメッセージ例 | 原因 | 対処 |
   |---|---|---|
   | `OPENAI_API_KEY` が未設定 | シークレット未登録 | Settings でシークレットを追加 |
   | `429` (rate_limit_exceeded) | API のレート制限超過 | 数分待ってから再実行 |
   | `401` (invalid_api_key) | API キーが無効 | キーを再発行して更新 |
   | `HTTP 403` (コメント投稿) | `pull-requests: write` 権限不足 | ワークフローの `permissions` を確認 |

3. **手動再実行**: GitHub Actions の **Re-run jobs** ボタンで再実行する

### ケース2: レビューコメントが投稿されない

- ワークフローのログで `Comment posted: HTTP 201` が出力されているか確認する
- `GITHUB_TOKEN` の権限（`pull-requests: write`）が有効か確認する

---

## 自動レビューの一時停止

### 方法1: ワークフローを無効化する（推奨）

GitHub リポジトリの **Actions > Codex Auto Review > Disable workflow** から無効化できます。再有効化も同様の手順で行います。

### 方法2: ブランチ制限を変更する

`.github/workflows/codex-review.yml` の `branches` をコメントアウトする。

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      # - main  # 一時停止中
```

変更を `main` へマージすると無効化されます。

---

## コスト・制限事項

| 項目 | 詳細 |
|---|---|
| 使用モデル | `codex-5.3` |
| 使用エンドポイント | `POST /v1/responses` |
| 最大 diff サイズ | 30,000 文字（超過分は切り捨て） |
| 最大出力トークン | 2,000 tokens |
| API コスト | PR ごとに OpenAI API の従量課金が発生する |

大規模な diff は切り捨てられるため、巨大な PR はファイル単位に分割することを推奨します。

---

## FAQ

**Q: 自動レビューのコメントはどこに表示されますか？**
A: PR の **Conversation** タブにコメントとして投稿されます。

**Q: 同じ PR にコミットを追加するとレビューは再実行されますか？**
A: はい、`synchronize` イベントでトリガーされます。ただし、前回のコメントは削除されず新たに追加されます。

**Q: fork からの PR もレビューされますか？**
A: GitHub Actions の仕様により、fork からの PR では `GITHUB_TOKEN` の権限が制限される場合があります。その場合はコメント投稿がスキップされます。

**Q: レビューで指摘された内容は必ず対応が必要ですか？**
A: 自動レビューはあくまで補助ツールです。最終的な判断は人間のレビュアーが行ってください。
