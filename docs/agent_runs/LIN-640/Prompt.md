# LIN-640 Prompt

## Goal
- Add Firebase Web SDK bootstrap layer aligned with frontend env contract.
- Implement `AuthProvider` / `AuthSession` so auth state is accessible app-wide.
- Provide shared ID token API boundary usable by both REST and WS callers.
- Reflect auth state transitions (`initializing` / `authenticated` / `unauthenticated`) in UI handling.

## Non-goals
- Wiring login/register/verify/reset screens to Firebase operations.
- Implementing REST API adapter (`authenticatedFetch`) or WS ticket/identify flow.
- Persisting raw token to `localStorage` / `sessionStorage`.
- SSR session cookie support.

## Done conditions
- Auth state transitions are observable from protected route UI.
- Shared token API can be called from outside auth internals.
- Design avoids token persistence in browser storage.
- TypeScript tests and typecheck pass for modified scope.
