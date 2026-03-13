# Plan

## Rules
- Stop-and-fix: validation / review 失敗時は次工程へ進まない。
- Scope lock: LIN-977 は AuthZ runtime default provider と期限管理に限定する。
- Start mode: child issue start (`LIN-977` under `LIN-976`)。

## Milestones
### M1: runtime provider の fail-close default を実装する
- Acceptance criteria:
  - [ ] `AUTHZ_PROVIDER` 未設定 / 空文字 / unknown が fail-close になる
  - [ ] `AUTHZ_PROVIDER=spicedb` 設定不備時の fail-close を維持する
  - [ ] `AUTHZ_PROVIDER=noop` は明示指定時のみ allow-all を有効にする
- Validation:
  - `cd rust && cargo test -p linklynx-api authz::tests::runtime_provider_`

### M2: noop 一時例外の期限管理を固定する
- Acceptance criteria:
  - [ ] `AUTHZ_ALLOW_ALL_UNTIL` 期限内のみ allow-all になる
  - [ ] 不正値または期限切れ時は fail-close になる
  - [ ] 理由コードと運用文書が更新されている
- Validation:
  - `cd rust && cargo test -p linklynx-api authz::tests::runtime_provider_noop_`

### M3: ドキュメント更新と全体検証を完了する
- Acceptance criteria:
  - [ ] `docs/AUTHZ.md` と runbook が runtime 契約に一致する
  - [ ] review gate の blocking finding がない
  - [ ] 検証結果を `Documentation.md` に記録する
- Validation:
  - `make rust-lint`
  - `make validate`
