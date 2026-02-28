CREATE SEQUENCE IF NOT EXISTS users_id_seq AS BIGINT;

SELECT setval(
  'users_id_seq',
  COALESCE((SELECT MAX(id) FROM users), 1),
  EXISTS (SELECT 1 FROM users)
);

ALTER SEQUENCE users_id_seq OWNED BY users.id;
ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq');
