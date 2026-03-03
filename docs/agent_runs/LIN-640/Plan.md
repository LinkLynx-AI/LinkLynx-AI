# LIN-640 Plan

## Milestones
1. Add `firebase` dependency and lock updates for TypeScript workspace.
2. Add shared Firebase bootstrap helpers (app/auth singleton + env contract usage).
3. Introduce `entities/auth` with `AuthProvider`, `AuthSession`, and shared `getIdToken` boundary.
4. Integrate auth provider into global providers chain.
5. Reflect auth transitions in protected route gate behavior.
6. Add/adjust tests for auth state and route gate behavior.
7. Run validations and record results.

## Validation commands
- `cd typescript && npm run test`
- `cd typescript && npm run typecheck`

## Acceptance checks
- Login/logout-equivalent auth events transition session state correctly.
- `getIdToken(forceRefresh?)` boundary is reusable for downstream REST/WS implementation.
- Token persistence via `localStorage` / `sessionStorage` is not introduced.
