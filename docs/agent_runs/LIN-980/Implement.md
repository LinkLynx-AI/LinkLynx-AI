# Implement

- permission-snapshot の response contract は維持し、handler logging と文書だけを最小変更で更新する。
- 監査ログ項目は helper へ寄せ、route test と unit test で固定する。
- current state と future cutover を混同しないよう、文書は「今の境界」と「次回条件」を分けて書く。
