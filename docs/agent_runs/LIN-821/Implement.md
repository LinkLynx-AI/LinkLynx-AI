# Implement

- Plan.md の順序に従って進める。
- message 契約の shape を変える変更は、runbook とテストを同時に更新する。
- additive only の根拠が崩れる変更は入れない。
- 検証結果、判断理由、後続 issue への引き継ぎ事項は Documentation.md に都度追記する。
- `linklynx_message_api` を追加し、guild message の REST canonical DTO、opaque cursor、paging helper、validation helper を実装した。
- `linklynx_protocol_ws` を追加し、`message.subscribe` / `message.unsubscribe` と `message.subscribed` / `message.unsubscribed` / `message.created` の frame 契約を固定した。
- `linklynx_protocol_events` を追加し、durable event として `message_create` catalog 名、および payload `type = MessageCreated` を固定した。
- `apps/api` の guild message HTTP/WS stub は shared contract 参照へ差し替え、既存の AuthZ close/error 契約は維持した。
- paging 順序、cursor ルール、event class の不整合は runbook 側も同時に更新して SSOT を揃えた。
