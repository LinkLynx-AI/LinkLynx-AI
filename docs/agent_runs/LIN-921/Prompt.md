# LIN-921 Prompt

- Issue: `LIN-921`
- Title: `[v1/RM-06-03] DM 投稿・受信を成立させる`
- Goal: DM の投稿と受信を成立させ、timeline 表示と受信反映を整合させる。
- In scope:
  - DM send/list 既存導線を realtime 受信まで接続する
  - DM route の WS subscribe と cache update を成立させる
  - backend/frontend の回帰テスト追加
- Out of scope:
  - 既読同期の高度化
  - DM edit/delete
  - group DM
  - 既存 guild realtime 契約の破壊的変更
