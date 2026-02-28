# LIN-485 Prompt

## Goal
- LIN-485（メイン導線UI）を、LIN-517/518/516/523 を内包して実装完了する。
- UI の見た目は `designs/discord-unified.pen` を一次ソースとして反映する。

## Non-goals
- API/DB/WS 実処理の追加。
- 認証ロジック本体の実装。

## Done conditions
- 左カラム（server rail + channel/dm list）の状態表現が再利用可能である。
- 会話UI（timeline + composer）が channel/dm 導線で表示可能である。
- 招待UIで valid/invalid/expired と認証後復帰導線が確認できる。
- pending/failed/retry/jump/edit/delete のメッセージ状態表現が確認できる。
