# Documentation.md

## Current status

- Parent issue `LIN-976`
- Completed child issues before this run:
  - `LIN-977`
  - `LIN-978`
  - `LIN-979`
  - `LIN-980`
  - `LIN-981`
  - `LIN-984`
  - `LIN-985`
  - `LIN-986`
  - `LIN-987`

## Working notes

- Remaining child issues are being implemented in grouped code changes locally, then validated and documented here.

## Validation notes

- Rust:
  - `cd rust && cargo test -p linklynx_backend`
  - passed with ignored TCP-bound WS fanout tests unchanged
- TypeScript:
  - `cd typescript && npm audit --json`
  - clean after `npm audit fix --package-lock-only`
  - `cd typescript && npm install`
  - `cd typescript && npm run typecheck`
- Python:
  - `docker run --rm -v ... python:3.12-slim ... pip-audit -r requirements.txt -r requirements-dev.txt`
  - clean after bumping `fastapi`, `starlette`, `black`

## Known gaps

- `make validate` and `make rust-lint` were not run yet in this pass.
- Python validation was executed in `python:3.12-slim` because host Python is `3.8.10` and cannot install the target dev toolchain cleanly.
