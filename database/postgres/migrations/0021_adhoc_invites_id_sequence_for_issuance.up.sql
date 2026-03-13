CREATE SEQUENCE IF NOT EXISTS invites_id_seq;

SELECT setval(
  'invites_id_seq',
  COALESCE((SELECT MAX(id) FROM invites), 1),
  EXISTS(SELECT 1 FROM invites)
);

ALTER TABLE invites
  ALTER COLUMN id SET DEFAULT nextval('invites_id_seq');

ALTER SEQUENCE invites_id_seq OWNED BY invites.id;
