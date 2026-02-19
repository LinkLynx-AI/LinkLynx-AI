# TypeScript フロントエンド規約

## 0. このドキュメントの目的
- コード品質・可読性・保守性・スケール（人数/機能増）に耐える一貫ルールを提供する
- レビューの論点を設計・仕様に寄せ、スタイル差分を減らす
- 自動化できるものは自動化（lint/format/typecheck）し、人間の判断が必要なものだけを規約化する

## 1. ルールの優先順位（衝突時）
1. Type checker（TypeScript）
2. Linter（ESLint）
3. Formatter（Prettier）
4. 本ドキュメント（AGENTS.md）

## 2. 絶対ルール（Non-Negotiables）
- `strict: true` 前提（型安全を落とさない）
- `any` は原則禁止（境界層で `unknown` をパース/ガードしてから扱う）
- `eslint-disable` / `@ts-expect-error` は「理由コメント + チケットID + 期限 + 行単位」でのみ許可
- `@ts-ignore` は禁止
- FSDのレイヤー境界・Public API を破る import を禁止（deep import禁止）
- `useEffect` は外部システム同期以外で使わない

## 3. FSD（Feature-Sliced Design）規約

### 3.1 レイヤーと依存方向
- 依存方向は上位 -> 下位のみ（逆は禁止）
- 本プロジェクトの基本レイヤー: `app -> widgets -> features -> entities -> shared`
- `pages` は必要時のみ採用し、採用時の依存方向は `app -> pages -> widgets -> features -> entities -> shared`
- `shared` はドメイン知識を持たない（汎用UI/ユーティリティ/基盤のみ）

### 3.2 Slices / Segments の責務
- `ui/`: 表示（React component, styles）
- `model/`: 状態・ドメインロジック（store, hooks, reducers, usecases）
- `api/`: 通信（fetcher, query fn, DTO, client）
- `lib/`: その slice 内だけの補助（pure util）
- `config/`: 定数・設定

### 3.3 Public API（index.ts）
- 各 slice は外部公開するものだけを `index.ts` で re-export する
- import は必ず Public API 経由（deep import 禁止）
- Public API は内部実装を隔離する契約として扱う

### 3.4 型（types）の置き場所
- slice固有の型: slice内（`model/types.ts` など）
- 複数sliceで共有されるドメイン型: `entities/<entity>/model` へ寄せる
- 汎用共通型（`Result`, `ID` など）: `shared` に置く

## 4. TypeScript 規約

### 4.1 禁止/制限
- `any` 原則禁止（暫定対応は `unknown` + パース/ガード）
- non-null assertion（`!`）原則禁止
- `as` による強引な型アサーションは境界層に閉じ込める

### 4.2 型定義スタイル
- `type` 優先
- 拡張前提の contract が必要な場合のみ `interface`
- `enum` 原則禁止（`as const` + union を優先）

### 4.3 strict 拡張
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`

## 5. React 規約（設計）
- UI と状態/副作用を分離する（`ui/` と `model/`）
- `useEffect` は外部システム同期（network, browser API, event subscription, timer, non-React library）に限定
- props/state から導出できる値を `useEffect` + `setState` で同期しない

## 5.1 実装・テスト方針
- 関数はテスト可能なように、責務ごとに可能な限り分割する。
- テストは可能な限り実装し、回帰防止を優先する。
- 純粋関数と外部連携（I/O・HTTP・ブラウザAPI・状態更新など）を分離する。

## 6. コメント規約
- 「何をするか」ではなく「なぜそうするか」を書く
- TODO/FIXME にはチケットIDを必須化
- `eslint-disable` / `@ts-expect-error` には理由・チケットID・期限を必須化

## 7. JSDoc 規約
- 必須対象:
  - Public API（`index.ts` から export される関数/Hook/コンポーネント）
  - `api/` の外部I/O境界
  - 罠があるロジック（キャッシュ、並行性、重い計算、レース条件）

```ts
/**
 * 何をするか（1行）
 *
 * Contract:
 * - 入力の前提
 * - 戻り値の意味
 *
 * Errors:
 * - 失敗時の挙動（throw / null / Result）
 *
 * Side effects:
 * - network / storage / analytics / DOM 等
 */
```

## 8. import / 依存規約
- import は alias（`@/`）を使用し、深い相対参照を避ける
- `features/entities/widgets/pages` は Public API 経由 import のみ許可
- 循環参照は原則禁止
- `default export` は原則禁止
- Next.js 必須ファイル（`app/**/page.tsx`, `app/**/layout.tsx`, `app/**/loading.tsx`, `app/**/error.tsx`, `app/**/not-found.tsx`, `app/**/template.tsx`, `app/**/default.tsx`）のみ `default export` を例外許可

## 9. 境界層ルール（Zod）
- 外部入力（API response, URL query, storage, env）は `api/` または境界層で `Zod` により parse する
- parse 済みの値だけを内側レイヤーへ渡す

## 10. テスト規約（最低限）
- `model/`（純ロジック）: unit test 優先
- `ui/`（描画）: component test（必要最小）
- E2E: 重要導線（認証、メッセ送信、権限）を優先

## 11. 例外運用
- 例外はコメントで理由・チケットID・期限を必須化
- 例外が恒久化した場合は規約またはlintルールを更新する

## 12. 自動検査対応表
- `any` 禁止: ESLint（`@typescript-eslint/no-explicit-any`）
- non-null assertion 禁止: ESLint（`@typescript-eslint/no-non-null-assertion`）
- `type` 優先: ESLint（`@typescript-eslint/consistent-type-definitions`）
- deep import 禁止: ESLint（`no-restricted-imports`, `import/no-internal-modules`）
- 循環参照禁止: ESLint（`import/no-cycle`）
- `default export` 禁止: ESLint（`import/no-default-export`）
- React Hooks順守: ESLint（`react-hooks`）
- 型安全: TypeScript（`tsc --noEmit`）
- 整形: Prettier

## 13. レビューで落とすアンチパターン
- deep import（Public API無視）
- `shared` へのドメインロジック配置
- `ui` への fetch / 永続化 / analytics の混在
- 派生状態を `useEffect` で同期
- 根拠なしの全面メモ化
