# Implement

- Follow `Plan.md` as the execution order.
- 追加テストは brittle edge に限定し、既存の主経路テストを重複させない。
- runbook 追記は local 再現性と fail-close 切り分けを優先する。
- `AUTHZ_UNAVAILABLE` / guard / invalidation 観察ポイントは absolute command sequence で書く。
