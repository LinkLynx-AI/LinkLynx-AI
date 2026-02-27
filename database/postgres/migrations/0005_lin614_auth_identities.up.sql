CREATE TABLE auth_identities (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  principal_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT auth_identities_pkey PRIMARY KEY (provider, provider_subject),
  CONSTRAINT uq_auth_identities_provider_principal UNIQUE (provider, principal_id),
  CONSTRAINT chk_auth_identities_provider_non_empty CHECK (length(provider) > 0),
  CONSTRAINT chk_auth_identities_provider_subject_non_empty CHECK (length(provider_subject) > 0)
);

CREATE INDEX idx_auth_identities_principal_id
  ON auth_identities (principal_id);

