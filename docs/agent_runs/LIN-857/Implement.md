# LIN-857 Implement Rules

- 破壊的変更は権限系に限定し、非権限テーブルへ波及させない。
- down migration は構造再作成のみを行い、データ復元は対象外。
- seedはv0テーブルへのINSERTを残さない。
