# Prompt.md (Spec / Source of truth)

## Goals
- `auth.identify` の rate-limit key を origin 共有から外し、少なくとも principal または session 単位で分離する。
- `Origin` 欠落時でも `origin_missing` の単一 bucket に全 client が収束しないようにする。
- `identify_rate_limited` の decision log に key の由来を追跡できる情報を残し、既存の `1008` close 契約を維持する。

## Non-goals
- `/ws` の AuthZ 契約や `1008/1011` マッピング自体は変えない。
- WS ticket 発行 API や Origin allowlist の仕様変更は行わない。
- pre-auth concurrent connection cap や frame size cap など別 issue の対策は混ぜない。

## Deliverables
- WS identify rate-limit key の再設計と実装
- regression tests
- 관련 docs / run memory 更新

## Done when
- [ ] 同一 origin の別ユーザーが identify bucket を共有しない
- [ ] `Origin` なしでも単一 shared bucket に束ねられない
- [ ] `identify_rate_limited` / close reason / observability 契約が維持される
- [ ] docs と PR evidence に key source が明記される

## Constraints
- Perf: identify guard 自体は残し、無制限化しない
- Security: raw ticket は log に出さず、未認証 client の共有 bucket を復活させない
- Compatibility: `/ws + auth.identify(ticket)` の wire contract は変えない
