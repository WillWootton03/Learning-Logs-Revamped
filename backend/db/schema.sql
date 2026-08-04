CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id     TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boards (
  board_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  mastery_threshold INT NOT NULL DEFAULT 20,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logs (
  log_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concepts (
  concept_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id                 UUID NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
  prompt                   TEXT NOT NULL,
  answer                   TEXT NOT NULL,
  hint                     TEXT,
  times_answered_correctly INT NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  tag_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board_id, name)
);

CREATE TABLE IF NOT EXISTS concept_tags (
  concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (concept_id, tag_id)
);
