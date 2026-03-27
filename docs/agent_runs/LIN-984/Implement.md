# Implement

- internal endpoint は `rest_auth_middleware` から外し、dedicated internal guard へ移す。
- guard は shared secret ベースで fail-close し、一般 bearer token と AuthZ allow-all 例外に依存させない。
- 監査ログには `request_id`、`caller_boundary`、`outcome` を残す。
- docs は `AUTHZ_API_MATRIX` を SSOT として更新し、ops runbook から internal metrics 利用方法が追えるようにする。
