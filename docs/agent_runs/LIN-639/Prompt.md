# LIN-639 Prompt

## Goal
- Align authentication runtime env contracts across frontend/backend.
- Align `docker-compose.yml` and `.env.example` files with that contract.
- Enforce startup fail-fast on missing or invalid env values.
- Add runbook-only local reproduction steps.

## Non-goals
- Secret values commit.
- Production operation policy change.
- REST/WS auth feature expansion.

## Done conditions
- Missing required env fails startup with explicit reason.
- Runbook steps alone reproduce local auth runtime startup.
- Frontend/backend env contract gaps are removed.
