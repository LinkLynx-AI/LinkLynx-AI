ALTER TABLE users
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN password_hash TEXT NOT NULL DEFAULT '$argon2id$v=19$m=65536,t=3,p=1$placeholder$placeholder';

ALTER TABLE users
  ADD CONSTRAINT chk_users_password_hash_argon2id
    CHECK (password_hash LIKE '$argon2id$%');

COMMENT ON COLUMN users.password_hash
  IS 'Argon2id の PHC 文字列（例: $argon2id$v=19$...）を保存する。';

CREATE TABLE email_verification_tokens (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_verification_expires
  ON email_verification_tokens (expires_at);

CREATE TABLE password_reset_tokens (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_expires
  ON password_reset_tokens (expires_at);
