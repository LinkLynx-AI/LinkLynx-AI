# Prompt

- 依頼: `typescript` ディレクトリをFSDに準拠させる。
- 制約: UI/挙動は変えず、主にファイル名・ディレクトリ構造を修正する。
- 準拠基準: `docs/TYPESCRIPT.md` のレイヤ構造 (`app -> widgets -> features -> entities -> shared`) とセグメント方針。
- 追加依頼: `/legacy/` を完全排除し、`widgets` 偏重を是正して `features` 中心の理想構成へ再配置する。
- 追加依頼: TypeScript の FSD 境界チェックを導入し、`make` から実行できるようにする。
