# Documentation.md (Status / audit log)

## Current status
- Now: LIN-933 implemented and validated on both TypeScript and Rust paths.
- Next: create PR and hand off for human review on `main`.

## Decisions
- `LIN-933` includes immediate protected-screen light/dark application, not just persisted selection in settings.
- Allowed theme values stay aligned with backend contract: `dark | light`.
- Theme runtime sync is driven from the existing profile synchronization path and a single settings store.
- On reload, `SettingsThemeBridge` first bootstraps from `next-themes` persisted value, then reconciles to the profile-backed store value.
- Auth screens remain out of scope for this issue.

## How to run / demo
- 1. Open `/settings/appearance`.
- 2. Select `ライト` or `ダーク`.
- 3. Click `変更を保存`.
- 4. Confirm the protected UI switches theme immediately.
- 5. Reload and confirm the selected theme is still the initial state.
- 6. Run `make ts-validate`.
- 7. Run `make rust-validate`.

## Known issues / follow-ups
- Root `make validate` is blocked by local Python tooling: `/usr/bin/python3: No module named pip` during `python make format`.
- `make ts-validate` completed after allowing `pnpm run lint` enough time to finish.
- `make rust-validate` completed after installing `cargo-llvm-cov`; coverage summary finished above the configured 45% threshold (`TOTAL lines 56.26%`).
- Existing React `act(...)` warnings remain in `user-profile` tests, and the new `user-appearance` tests show the same pattern without failing the suite.
