CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT NOT NULL,

  display_name TEXT NOT NULL,
  avatar_key TEXT,
  status_text TEXT,
  theme TEXT NOT NULL DEFAULT 'dark',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_users_theme CHECK (theme IN ('dark', 'light')),
  CONSTRAINT chk_users_password_hash_argon2id
    CHECK (password_hash LIKE '$argon2id$%')
);

CREATE UNIQUE INDEX uq_users_email_lower
  ON users (lower(email));

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

CREATE OR REPLACE FUNCTION set_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_users_updated_at();
