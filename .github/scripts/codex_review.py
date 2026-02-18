#!/usr/bin/env python3
"""Codex PR auto-review script.

Reads the PR diff, calls the OpenAI API for a code review,
and posts the result as a PR comment via the GitHub API.
"""

import json
import os
import sys
import urllib.error
import urllib.request

from openai import OpenAI

DIFF_FILE = "pr.diff"
MAX_DIFF_CHARS = 30_000  # Truncate very large diffs to stay within token limits

SYSTEM_PROMPT = """\
あなたは経験豊富なシニアエンジニアです。
提供されたgit diffに対してコードレビューを行ってください。

## レビューの観点
- **バグ・論理的な誤り**: 潜在的なバグや意図しない動作
- **セキュリティ**: 脆弱性・インジェクション・機密情報の漏洩リスク
- **パフォーマンス**: 不必要なN+1クエリ、無駄なアロケーション等
- **可読性・保守性**: 命名・コメント・複雑すぎるロジック
- **テスト**: 重要なケースのテスト漏れ

## 出力フォーマット
Markdownで、以下のセクションに分けて出力してください。

### 🔍 サマリー
変更内容を1〜3文で要約する。

### ✅ 良い点
変更の中で評価できる点をリストアップする（なければ省略可）。

### ⚠️ 要確認・改善提案
問題点・改善案を優先度（高/中/低）とともにリストアップする。
ファイル名と行番号が特定できる場合は記載する。

### 💡 その他コメント
任意の補足情報（なければ省略可）。

問題がなければ「問題なし、LGTMです。」と記載してください。
"""


def load_diff() -> str:
    if not os.path.exists(DIFF_FILE):
        print(f"ERROR: {DIFF_FILE} not found", file=sys.stderr)
        sys.exit(1)

    with open(DIFF_FILE, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    if not content.strip():
        return ""

    if len(content) > MAX_DIFF_CHARS:
        content = content[:MAX_DIFF_CHARS]
        content += f"\n\n... (差分が大きいため {MAX_DIFF_CHARS} 文字で打ち切りました)"

    return content


def call_openai(diff: str) -> str:
    client = OpenAI()

    pr_title = os.environ.get("PR_TITLE", "")
    base_ref = os.environ.get("BASE_REF", "main")
    head_ref = os.environ.get("HEAD_REF", "")

    user_content = (
        f"PR タイトル: {pr_title}\n"
        f"ベースブランチ: {base_ref}\n"
        f"ヘッドブランチ: {head_ref}\n\n"
        f"## git diff\n```diff\n{diff}\n```"
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
        max_tokens=2000,
    )

    return response.choices[0].message.content or ""


def post_pr_comment(body: str) -> None:
    token = os.environ["GITHUB_TOKEN"]
    repo = os.environ["REPO"]
    pr_number = os.environ["PR_NUMBER"]

    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    payload = json.dumps({"body": body}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Comment posted: HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"ERROR posting comment: HTTP {e.code} {e.reason}", file=sys.stderr)
        print(e.read().decode(), file=sys.stderr)
        sys.exit(1)


def main() -> None:
    diff = load_diff()

    if not diff:
        print("Diff is empty – skipping review.")
        body = "## 🤖 Codex Auto Review\n\n差分が空のため、レビューをスキップしました。"
        post_pr_comment(body)
        return

    print(f"Diff loaded ({len(diff)} chars). Calling OpenAI API...")
    review = call_openai(diff)

    body = f"## 🤖 Codex Auto Review\n\n{review}\n\n---\n*このコメントは自動生成されました。*"
    post_pr_comment(body)
    print("Done.")


if __name__ == "__main__":
    main()
