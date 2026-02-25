# Python コーディングルール

## 1. 基本方針
- PEP 8 に準拠し、可読性を優先する
- 型ヒントを必須とし、公開関数は引数と戻り値を明示する
- 依存関係は `requirements.txt` と `requirements-dev.txt` で管理する

## 2. フォーマット / Lint / テスト
- フォーマット: `black`
- Lint: `ruff`
- テスト: `unittest`

実行コマンド（`python/` ディレクトリ）:

```bash
make format
make lint
make test
make validate
```

## 3. 命名規約
- モジュール・関数・変数: `snake_case`
- クラス: `PascalCase`
- 定数: `UPPER_SNAKE_CASE`

## 4. FastAPI ルール
- ルーティング層では入出力変換とバリデーションに集中し、重い業務ロジックを直接書かない
- ヘルスチェックは `GET /health` を維持する
- API レスポンスは JSON 構造を安定させる

## 5. 例外処理
- 例外を握りつぶさない
- 想定可能な失敗は明示的に扱い、エラーメッセージは原因が分かる内容にする
- 汎用 `Exception` の広域捕捉は避ける
