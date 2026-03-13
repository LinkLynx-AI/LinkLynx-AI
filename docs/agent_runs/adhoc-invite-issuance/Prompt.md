# Invite Issuance Prompt

## Goals
- 既存の公開 invite verify/join に加えて、認証済みユーザーが招待を発行できる最小フローを追加する。
- backend と frontend の両方で、実 API を使って招待リンクを生成できるようにする。
- 既存の guild permission snapshot の `can_create_invite` と UI の disable 条件を整合させる。

## Non-goals
- 招待一覧取得や取消 API の本実装。
- invite に channel 永続紐付けを追加する大きな schema 変更。
- 既存の非 `v1` surface や unrelated AuthZ 改修。

## Deliverables
- invite create backend API と service 実装。
- frontend API client / mutation / modal UI。
- 主要な context menu / channel action からの導線接続。
- 回帰テストと最小ドキュメント更新。

## Done when
- [ ] 権限があるユーザーが modal から招待リンクを生成できる
- [ ] 生成結果として URL と invite metadata を表示できる
- [ ] invite create route が validation / unavailable を返せる
- [ ] 追加したテストが通る

## Constraints
- Security: invite 発行不可ユーザーには既存 guard どおり fail-close で見せる
- Compatibility: 既存 public invite verify/join 契約は壊さない
- Scope: 招待発行に必要な最小差分に留める
