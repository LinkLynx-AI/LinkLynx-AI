# LIN-620 Prompt

## Goal
- Implement LIN-620 parent and child issues (LIN-621/622/624/623) in sequence.
- Enforce Firebase as the only authentication source of record at runtime.
- Add idempotent first-auth principal provisioning and email verification enforcement.
- Reflect Firebase-delegated reset responsibility in runtime/docs.

## Non-goals
- AuthZ implementation changes.
- Additional auth provider support.
- UI changes.

## Done conditions
- Local password/reset DB/runtime paths are removed.
- Missing uid mapping is provisioned idempotently on first auth.
- Unverified email is denied consistently in REST/WS.
- Reset responsibility/docs are aligned to Firebase delegation.
