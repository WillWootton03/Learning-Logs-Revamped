CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  full_name      TEXT,
  password_hash  TEXT,
  google_id      TEXT UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  -- Bumped every time the password changes. Tokens embed the value they were
  -- minted against, so a password reset/change revokes every older session.
  password_it    INT NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Password reset tokens. One row per user (a new request overwrites the old
-- token), so a user can never have two live reset links. The token is a
-- random hex string and is the primary key; requested_at backs the expiry
-- check. Rows are deleted once the reset is used.
CREATE TABLE IF NOT EXISTS password_resets (
  token         TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boards (
  board_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  subject           TEXT NOT NULL DEFAULT 'Other',
  color             TEXT NOT NULL DEFAULT '#7c6af7',
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

-- Saved quiz definitions (settings only — not a run).
CREATE TABLE IF NOT EXISTS quiz_settings (
  quiz_settings_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id         UUID NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  style            TEXT NOT NULL CHECK (style IN ('true_false', 'multiple_choice', 'fill_in')),
  include_known    BOOLEAN NOT NULL DEFAULT false,
  exact_matching   BOOLEAN NOT NULL DEFAULT false,
  match_all_tags   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional tag filter for a saved quiz definition.
-- If no tags are specified, all concepts are included.
CREATE TABLE IF NOT EXISTS quiz_settings_tags (
  quiz_settings_id UUID NOT NULL REFERENCES quiz_settings(quiz_settings_id) ON DELETE CASCADE,
  tag_id           UUID NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (quiz_settings_id, tag_id)
);

-- An actual quiz attempt/run. quiz_settings_id is NULL for one-off quizzes.
-- board_id is stored directly on the run so one-off quizzes (which have no
-- quiz_settings) are still board-scoped and listable.
CREATE TABLE IF NOT EXISTS quiz (
  quiz_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id         UUID NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
  quiz_settings_id UUID REFERENCES quiz_settings(quiz_settings_id) ON DELETE SET NULL,
  questions_count  INT NOT NULL,
  time_elapsed_ms  BIGINT NOT NULL,
  correct_count    INT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-question results within a quiz run. position preserves the order the
-- questions were asked in, so a breakdown can reproduce the original quiz.
-- position used for ordering the questions in the quiz run.
CREATE TABLE IF NOT EXISTS quiz_questions (
  quiz_question_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id            UUID NOT NULL REFERENCES quiz(quiz_id) ON DELETE CASCADE,
  concept_id         UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
  position           INT NOT NULL,
  answered_correctly BOOLEAN NOT NULL
);

-- Indexes for the FK columns used in every board-scoped query.
-- (users.email / users.google_id and tags(board_id, name) are already
--  indexed by their UNIQUE constraints, so no extra indexes are needed.)
CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards (user_id);
CREATE INDEX IF NOT EXISTS idx_logs_board_id ON logs (board_id);
CREATE INDEX IF NOT EXISTS idx_concepts_board_id ON concepts (board_id);
-- concept_tags PK covers concept_id-first lookups; tag_id needs its own
-- index for tag-filtered concept lists and quiz tag filtering.
CREATE INDEX IF NOT EXISTS idx_concept_tags_tag_id ON concept_tags (tag_id);

CREATE INDEX IF NOT EXISTS idx_quiz_settings_board_id ON quiz_settings (board_id);
CREATE INDEX IF NOT EXISTS idx_quiz_settings_tags_tag_id ON quiz_settings_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_quiz_board_id ON quiz (board_id);
CREATE INDEX IF NOT EXISTS idx_quiz_quiz_settings_id ON quiz (quiz_settings_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_concept_id ON quiz_questions (concept_id);

-- One reset row per user: the unique index backs both the per-user lookup
-- (requestReset / cleanup) and the ON CONFLICT upsert in the repository.
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets (user_id);

-- Idempotent migrations for databases created before these columns existed.
-- CREATE TABLE IF NOT EXISTS never alters an existing table, so existing
-- deployments pick these up via ADD COLUMN IF NOT EXISTS on re-run.
ALTER TABLE boards ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#7c6af7';
ALTER TABLE quiz_settings ADD COLUMN IF NOT EXISTS exact_matching BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE quiz_settings ADD COLUMN IF NOT EXISTS match_all_tags BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_it INT NOT NULL DEFAULT 1;


