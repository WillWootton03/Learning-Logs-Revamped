CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  full_name      TEXT,
  password_hash  TEXT,
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
-- (users.email and tags(board_id, name) are already indexed by their UNIQUE
--  constraints, so no extra indexes are needed.)
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
-- Google OAuth was removed; drop the column on databases created before this.
-- The users_self policy still references it, so drop the policy first (it is
-- recreated without google_id in the RLS section below).
DROP POLICY IF EXISTS users_self ON users;
ALTER TABLE users DROP COLUMN IF EXISTS google_id;


-- ============================================================================
-- Row-level security
-- ----------------------------------------------------------------------------
-- Every query the backend runs is filtered at the database layer by the owner
-- of the current request. The app publishes the authenticated user id with
-- set_config('app.current_user_id', ...) right after verifying the access
-- token (see db/pool.js + middleware/authenticate.js), so the DB refuses to
-- return or mutate rows the current user does not own — even if application
-- code forgets to filter. FORCE ROW LEVEL SECURITY is required because the
-- app connects as the table owner, who would otherwise bypass RLS entirely.
--
-- Ownership is indirect for most tables: concepts/logs/tags/quiz_settings/quiz
-- belong to a board, and the board belongs to the user. Policies on those
-- tables walk up to boards and compare the board's user_id.
--
-- Auth flows (register / login / verify / forgot / reset password) run BEFORE
-- any user is known, so `users` and `password_resets` carry narrow extra
-- policies keyed on the address or reset token that the backend sets for those
-- specific lookups only (never from user input).
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets FORCE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards FORCE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs FORCE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts FORCE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
ALTER TABLE concept_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE quiz_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE quiz_settings_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_settings_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz FORCE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions FORCE ROW LEVEL SECURITY;

-- The current user id. NULLIF + ::uuid keeps the cast safe when the setting
-- is unset (current_setting returns NULL), which fails closed to "no rows".
DROP POLICY IF EXISTS users_self ON users;
CREATE POLICY users_self ON users
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR email = NULLIF(current_setting('app.current_email', true), '')
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

-- Registration inserts a brand-new row before any session exists.
DROP POLICY IF EXISTS users_register ON users;
CREATE POLICY users_register ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS password_resets_self ON password_resets;
CREATE POLICY password_resets_self ON password_resets
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR token = NULLIF(current_setting('app.current_reset_token', true), '')
  )
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS boards_owner ON boards;
CREATE POLICY boards_owner ON boards
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- Board-scoped tables: the row's board must belong to the current user.
DROP POLICY IF EXISTS logs_owner ON logs;
CREATE POLICY logs_owner ON logs
  USING (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  WITH CHECK (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));

DROP POLICY IF EXISTS concepts_owner ON concepts;
CREATE POLICY concepts_owner ON concepts
  USING (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  WITH CHECK (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));

DROP POLICY IF EXISTS tags_owner ON tags;
CREATE POLICY tags_owner ON tags
  USING (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  WITH CHECK (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));

DROP POLICY IF EXISTS quiz_settings_owner ON quiz_settings;
CREATE POLICY quiz_settings_owner ON quiz_settings
  USING (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  WITH CHECK (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));

DROP POLICY IF EXISTS quiz_owner ON quiz;
CREATE POLICY quiz_owner ON quiz
  USING (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  WITH CHECK (board_id IN (
    SELECT board_id FROM boards
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));

-- Join tables: walk through their parent (concept/tag, quiz_settings/tag,
-- quiz/question) up to the board, then to the current user.
DROP POLICY IF EXISTS concept_tags_owner ON concept_tags;
CREATE POLICY concept_tags_owner ON concept_tags
  USING (concept_id IN (
    SELECT c.concept_id FROM concepts c JOIN boards b ON b.board_id = c.board_id
    WHERE b.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  WITH CHECK (concept_id IN (
    SELECT c.concept_id FROM concepts c JOIN boards b ON b.board_id = c.board_id
    WHERE b.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));

DROP POLICY IF EXISTS quiz_settings_tags_owner ON quiz_settings_tags;
CREATE POLICY quiz_settings_tags_owner ON quiz_settings_tags
  USING (quiz_settings_id IN (
    SELECT qs.quiz_settings_id FROM quiz_settings qs JOIN boards b ON b.board_id = qs.board_id
    WHERE b.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  WITH CHECK (quiz_settings_id IN (
    SELECT qs.quiz_settings_id FROM quiz_settings qs JOIN boards b ON b.board_id = qs.board_id
    WHERE b.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));

DROP POLICY IF EXISTS quiz_questions_owner ON quiz_questions;
CREATE POLICY quiz_questions_owner ON quiz_questions
  USING (quiz_id IN (
    SELECT q.quiz_id FROM quiz q JOIN boards b ON b.board_id = q.board_id
    WHERE b.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  WITH CHECK (quiz_id IN (
    SELECT q.quiz_id FROM quiz q JOIN boards b ON b.board_id = q.board_id
    WHERE b.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));



