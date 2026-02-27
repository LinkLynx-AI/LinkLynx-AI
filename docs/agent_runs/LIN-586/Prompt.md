# LIN-586 Prompt

## Goal
- Implement LIN-586 by completing child issues LIN-614, LIN-615, LIN-616, LIN-617, LIN-619, LIN-618 in order.
- Enforce one issue = one PR compatible scope and keep changes additive.

## Non-goals
- Add new auth providers beyond Firebase.
- Implement AuthZ (SpiceDB/RBAC) in this run.
- Implement full session resume semantics from LIN-587.

## Done conditions
- REST and WS share Firebase auth verification and principal mapping flow.
- principal_id mapping contract is fixed in DB and runtime behavior.
- WS reauthentication flow on token expiry is implemented with fail-close behavior.
- Auth error policy, logs, metrics, and runbook are documented.
