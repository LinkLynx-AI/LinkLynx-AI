# Prompt.md

## Goal
- チャンネルカテゴリ機能の主要回帰を backend/frontend の自動テストで検知できる状態にする。
- `times` カテゴリ配下に `times-abe` を作る最小ローカル検証手順を Documentation に残す。

## Scope
- invalid parent / category 非 message target / mixed sidebar order / category 非遷移 / route fallback を優先する。
- 大規模な E2E 基盤追加や無関係なテスト整理は行わない。

## Acceptance checklist
- [ ] category 系の主要回帰が自動テストで検知できる
- [ ] `times` -> `times-abe` の最小手順がローカルで再現できる
- [ ] top-level channel と category child の混在でも sidebar / route state が壊れない
- [ ] invalid parent / forbidden / category 非遷移の観察ポイントが残る
