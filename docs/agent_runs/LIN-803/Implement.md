# LIN-803 Implement Rules

## Scope boundaries
- Touch only DB schema contract assets required by LIN-803.
- Keep changes additive and forward-only (LIN-588).
- Do not include category/thread or invite/DM/message logic.

## Decisions fixed in this run
- Use DB default sequence for `guilds.id` and `channels.id`.
- Enforce non-blank names for `guilds` and `channels(type='guild_text')`.
- Add list-focused indexes for LIN-806 handoff.

## Explicitly deferred
- Owner/member strict integrity trigger checks.
- API layer implementation and endpoint behavior changes.
