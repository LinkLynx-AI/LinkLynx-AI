# Implement.md

- Plan.md の順番を実行順とし、順序変更が必要なら Documentation.md に理由を残す。
- diff は LIN-826 の subscribe/publish 実装に閉じ、voice / presence / DM realtime は触らない。
- WS hub は in-process best-effort fanout に限定し、write path を fail-open / fail-close の新方針へ変更しない。
- `message.created` publish は completed replay を再送しない。
- validation は milestone ごとに実行し、失敗時は先に修正する。
