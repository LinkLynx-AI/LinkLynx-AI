# Implement.md

- 2026-03-18: Started LIN-976 parent implementation from remaining child queue.
- 2026-03-18: Current focus is WS/auth hardening (`LIN-988`, `LIN-990`, `LIN-991`, `LIN-992`, `LIN-993`, `LIN-994`).
- 2026-03-18: Implemented WS/auth hardening in Rust API: missing-Origin fail-close, query-ticket default disable, protected/auth CORS allowlist, pre-auth size/cap guards, invalid-token attempt rate limit.
- 2026-03-18: Moved `/users/me/dms` under protected routing and aligned fallback AuthZ handling for write paths.
- 2026-03-18: Updated dependency manifests: `typescript/package-lock.json`, `rust/Cargo.lock`, `python/requirements*.txt`.
