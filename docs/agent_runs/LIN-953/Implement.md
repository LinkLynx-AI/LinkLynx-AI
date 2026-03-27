# Implement

- Follow `Plan.md` as the execution order.
- Query/mutation は boundary で DTO を parse し、UI には整形済み model を渡す。
- permission snapshot による gate は既存 RouteGuard と整合する形で寄せる。
- mock fallback を残す場合も backend available 時の実経路を優先する。
