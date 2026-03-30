# Prompt.md (Spec / Source of truth)

## Goals
- Persist invite target channels in the database so invite ownership is channel-first.
- Expose channel metadata on invite payloads and let invite list/revoke operate with optional channel scoping.
- Make channel settings show only invites for the selected channel while server settings remains guild-wide.

## Non-goals
- Finalize invite-specific AuthZ semantics.
- Add authenticated runtime smoke automation.
- Refactor unrelated invite/join flows beyond the payload changes required for channel awareness.

## Deliverables
- Additive database migration for `invites.channel_id`.
- Backend invite API/service updates for channel-aware payloads and filtered list/revoke.
- Frontend API client and UI updates for channel-scoped invite management.
- Documentation and validation evidence for `LIN-996`.

## Done when
- [ ] New invites persist `channel_id`.
- [ ] Invite verify/list payloads include channel metadata.
- [ ] Channel settings shows only invites for the active channel.
- [ ] Server settings shows guild invites with channel metadata.
- [ ] Validation and targeted tests pass.

## Constraints
- Perf: keep invite list queries index-friendly.
- Security: preserve existing fail-close behavior and current guild-manage enforcement.
- Compatibility: keep existing guild invite routes working while adding optional `channel_id` filtering.
