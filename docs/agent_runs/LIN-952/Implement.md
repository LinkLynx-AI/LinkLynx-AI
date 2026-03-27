# Implement

- Follow `Plan.md` as the execution order.
- Prefer handler / middleware の AuthZ 境界で `Manage` / `View` / `Post` を決め、service では整合性検証と persistence に責務を寄せる。
- Keep `403/AUTHZ_DENIED`、`503/AUTHZ_UNAVAILABLE`、WS `1008/1011` aligned with `ADR-004`.
- Do not widen `AuthzResource` surface unless the current contract cannot express the route.
- If a service still needs DB lookups, restrict them to existence / ownership / validation checks rather than duplicated permission policy.
