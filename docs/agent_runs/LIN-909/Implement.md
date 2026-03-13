# Implement.md (Runbook)

- Plan.md の順で進める。
- profile media は `LIN-939` の signed URL 契約を使い、直接 Firebase Storage へは触らない。
- 保存時は avatar / banner の dirty target だけ upload して、その object key を `PATCH /users/me/profile` に渡す。
- avatar の即時反映は `auth-store` と relevant query cache を更新する。
- 失敗時は draft を保持し、再試行で同じ入力を再送できる状態を維持する。
