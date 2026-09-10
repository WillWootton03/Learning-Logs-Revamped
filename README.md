# Learning Logs

A personal learning platform that turns note-taking into active recall. Users capture **concepts** (question + answer + hint pairs) tagged with keywords, organize them into **boards** by topic, keep **learning logs** of their progress, and test themselves with **quizzes** that respect what they actually know.

Built as a learning project in prompt engineering, this is a production-grade full-stack application: layered backend architecture, PostgreSQL with row-level security, Redis caching, JWT auth with email verification, a React SPA, containerized CI/CD, and Datadog observability — deployed to EC2 behind Cloudflare.

- **Live site:** https://learning-logs.com
- **Interactive demo (no account needed):** https://learning-logs.com/demo
- **API base:** `/` (see [Backend routes](#backend-routes))

---

## Table of contents

- [Project structure](#project-structure)
- [The journey — how we built this](#the-journey--how-we-built-this)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Backend routes](#backend-routes)
- [Backend services](#backend-services)
- [Frontend](#frontend)
- [Security model](#security-model)
- [Testing](#testing)
- [Deployment & infrastructure](#deployment--infrastructure)
- [Observability](#observability)
- [My goals & reasons — EDIT ME](#my-goals--reasons--edit-me)
- [Local development](#local-development)

---

## Project structure

```
.
├── backend/                  # Express 4 API (JavaScript, layered)
│   ├── routes/               # HTTP routes per resource
│   ├── controllers/          # Request/response handling, status codes
│   ├── services/             # Business logic (auth, quiz, cache, mail, …)
│   ├── repositories/         # SQL access, parameterized queries
│   ├── middleware/           # authenticate, etc.
│   ├── db/                   # schema.sql, setup + role scripts
│   ├── tests/                # Jest unit + integration suites
│   └── app.js                # Express wiring, structured JSON request logs
├── frontend/react-ts/        # React 19 + TypeScript + Vite + Tailwind 4 SPA
│   └── src/app/
│       ├── pages/            # One component per route
│       ├── components/       # Shared UI (modals, charts, nav, …)
│       ├── context/          # Auth, board, concept, tag, session, log, theme
│       ├── lib/api/          # Per-resource API clients + shared HTTP client
│       ├── demo/             # Self-contained interactive demo (localStorage)
│       └── hooks/            # useIncrementalList, etc.
├── nginx/                    # SPA + API reverse proxy (Cloudflare TLS)
├── .github/workflows/        # CI (tests/lint/build) + Release (GHCR → EC2)
└── docker-compose.*.yaml     # dev, test, prod, release stacks
```

---

## The journey — how we built this

The project was built iteratively, feature by feature, with a running review cycle after each step. The ordering was deliberate — every feature leaned on the ones before it:

1. **Users & auth.** Started with a basic user MVC (routes → controllers → services → repositories over a `pg.Pool`). Then layered in real authentication: bcrypt password hashing, JWT **access + refresh tokens** in `httpOnly` cookies, and a stateless **email verification** flow (OTP-style JWT links). Password resets use a per-user `password_resets` table (one live token per user) and email links. Google OAuth was added and then **removed** — it carried ongoing per-user cost, and email/password + verification gave us the same security for free.

2. **Boards, logs, concepts, tags.** Once a user was authenticated, we built the domain: boards as the aggregate root (each board owns its concepts, tags, logs, and quiz settings), free-form learning logs, concepts as question/answer/hint triples, and tags with a many-to-many `concept_tags` join. Batch inserts were used for performance-critical operations (concept imports, tag linking, quiz settings tags), and `update` methods were reworked to push identity parameters first.

3. **Quizzes.** Saved quiz **settings** (name, style, tag filter, include-known toggle) and quiz **runs** with per-question results. Distractor logic was iterated heavily: we went from a convoluted full-pool shuffle down to a clean O(n) pattern that just picks 3 random answers per question. Added exact vs. lenient answer matching (Levenshtein fuzzy tolerance), and mastery tracking (`times_answered_correctly`) so known concepts drop out of quizzes unless explicitly included.

4. **Security hardening.** Row-level security on every table (`FORCE ROW LEVEL SECURITY` + `set_config` for the current user), a restricted database role for the app, password strength requirements, session revocation on password change (`password_it` embedded in tokens), disposable-email-domain blocking, and IDOR fixes (all board-scoped resources verified against the token's user).

5. **Performance.** Redis caching through Upstash for the five board-level list endpoints (30-minute TTL, per-user keys, board-wide invalidation on writes, fail-open on Redis errors). Indexes on every join/FK column that queries use. Frontend lazy-loading (`useIncrementalList`) so concepts/tags stream in 10 at a time instead of mounting hundreds of DOM nodes.

6. **Frontend polish.** A Figma-driven, responsive React SPA. Public landing page with animations and an interactive demo page that mirrors the real app entirely client-side (localStorage-backed, no account needed). Weekly accuracy bar charts on board details, concept/tag/session detail pages, CSV concept import, staged concept editing, and a custom theme system (public pages follow the browser's `prefers-color-scheme`).

7. **Deployment & ops.** Docker Compose for dev/test/prod, nginx reverse proxy serving the SPA and proxying the API behind one origin, Cloudflare Full (strict) TLS, GitHub Actions CI (unit + integration tests on a real Postgres) and a release pipeline that builds GHCR images and deploys to EC2 via a **self-hosted runner** (no inbound SSH). Datadog APM + logs for production observability, including cache hit/miss tracking per endpoint.

---

## Architecture

**Backend — layered (routes → controllers → services → repositories).** Controllers own HTTP concerns (status codes, request parsing). Services hold business logic (quiz generation, auth, answer matching, caching). Repositories are the only layer that touches SQL — always via parameterized queries on `pg.Pool`. A board is the aggregate root: concepts, tags, logs, and quiz settings are only ever addressed through `/boards/:boardId/...`.

**Frontend — React SPA.** Context providers mirror the backend resources (Auth, Board, Concept, Tag, Session, Log, Theme). API calls go through a shared client (`client.ts`) that handles token refresh, Cloudflare-challenge recovery, and consistent error typing. A separate `demo/` module simulates the whole app in `localStorage`.

**Routing** — nginx serves the built SPA at `/` and proxies `/auth|users|boards/*` to the backend, so everything lives behind one origin and the httpOnly auth cookies never cross origins.

```
Browser (React SPA)
   │  REST + httpOnly JWT cookies
   ▼
nginx  ── /assets, SPA fallback ──► static build
   │
   └── /auth|/users|/boards/* ──► Express API
                                    │
                                    ├─ controllers → services → repositories → PostgreSQL (Neon, RLS)
                                    └─ services/cache.js → Upstash Redis (30m TTL)
```

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| API | Node + Express 4 | Small, flexible, the standard for this architecture style |
| Database | PostgreSQL 16 on Neon | Relational fit for boards/concepts/tags/quizzes, first-class RLS + UUIDs via `pgcrypto` |
| Cache | Upstash Redis (REST) | Serverless Redis — no infra to run; fail-open caching |
| Auth | bcrypt + JWT (jsonwebtoken) | Access/refresh tokens in httpOnly cookies, stateless email tokens |
| Email | nodemailer + `disposable-email-domains` | Verification/reset emails, spam-address blocking |
| Tracing | dd-trace (Datadog APM) | Distributed traces + structured JSON logs with trace IDs |
| Frontend | React 19 + TypeScript + Vite | Fast builds, strict typing, first-class TS tooling |
| Styling | Tailwind CSS 4 + Motion (`motion/react`) | Design-system-style theming + declarative animations |
| Tests | Jest + Supertest | Unit tests for services; integration tests spin up a real Postgres |
| Infra | Docker Compose, nginx, GitHub Actions, GHCR, EC2, Cloudflare | Reproducible dev/test/prod, CI/CD, TLS at the edge |

---

## Backend routes

All protected routes require the access-token cookie (`router.use(authenticate)`), and every request is scoped to the authenticated user via RLS.

### `POST /auth/*` — public

| Route | Purpose |
|---|---|
| `POST /auth/register` | Create account (email + password), emails a verification code |
| `POST /auth/login` | Sign in; sets access + refresh cookies |
| `POST /auth/verify` | Verify email with the emailed code/link |
| `POST /auth/resend-verification` | Re-send the verification code |
| `POST /auth/forgot-password` | Email a password-reset link (requires verified email) |
| `POST /auth/reset-password` | Set a new password with a reset token |
| `POST /auth/logout` | Clear the auth cookies |
| `POST /auth/refresh` | Exchange the refresh cookie for a fresh access token |

### `/users/*` — the current user (authenticated)

| Route | Purpose |
|---|---|
| `GET /users/me` | Current profile |
| `PUT /users/me` | Update profile (name, email → triggers re-verification) |
| `PUT /users/me/password` | Change password (verified email required; revokes all sessions) |
| `DELETE /users/me` | Delete account (verified email required) |
| `GET /users/me/runs` | All quiz runs across every board — the global activity-log feed |

### `/boards` (authenticated)

| Route | Purpose |
|---|---|
| `GET /boards` | List boards (summary columns only) |
| `POST /boards` | Create a board (name, subject, color, mastery threshold) |
| `GET /boards/:boardId` | Board detail (full columns) |
| `PUT /boards/:boardId` | Update board settings |
| `DELETE /boards/:boardId` | Delete a board (cascades) |

### `/boards/:boardId/logs` (authenticated)

| Route | Purpose |
|---|---|
| `GET /logs` | List logs (summary) |
| `POST /logs` | Create a log |
| `DELETE /logs` | Delete all logs on the board |
| `GET /logs/:logId` · `PUT /logs/:logId` · `DELETE /logs/:logId` | Log detail / update / remove |

### `/boards/:boardId/concepts` (authenticated)

| Route | Purpose |
|---|---|
| `GET /concepts` | List concepts (summary; fuzzy-searchable by prompt/answer) |
| `POST /concepts` | Create a concept (batch-creates/links tags) |
| `POST /concepts/import` | CSV import (prompt, answer, hint, tags; tab-separated supported; batch) |
| `DELETE /concepts` | Delete all concepts on the board |
| `GET /concepts/:conceptId` | Concept detail |
| `PUT /concepts/:conceptId` | Update a concept (staged editing) |
| `PUT /concepts/:conceptId/learned` | Toggle the learned flag (updates mastery) |
| `DELETE /concepts/:conceptId` | Delete a concept |
| `GET/PUT/PUT/DELETE /concepts/:conceptId/tags[/:tagId]` | List / link (many or one) / unlink tags on a concept |

### `/boards/:boardId/tags` (authenticated)

| Route | Purpose |
|---|---|
| `GET /tags` | List tags (summary) |
| `POST /tags` | Create a tag |
| `POST /tags/bulk` | Batch-create tags |
| `DELETE /tags` | Delete all tags on the board |
| `GET /tags/:tagId` · `PUT /tags/:tagId` · `DELETE /tags/:tagId` | Tag detail / rename / remove |

### `/boards/:boardId/quiz-settings` (authenticated)

| Route | Purpose |
|---|---|
| `GET /quiz-settings` | List saved quiz settings (summary) |
| `POST /quiz-settings` | Create a saved setting |
| `GET /quiz-settings/:id` · `PUT` · `DELETE` | Setting detail / update / remove |
| `POST /quiz-settings/:id/tags` · `DELETE /quiz-settings/:id/tags` | Add / remove the tag filter (proper CRUD, no delete-and-re-add) |
| `GET /quiz-settings/:id/quizzes` | Runs produced from this setting |
| `POST /quiz-settings/:id/quizzes` | Record a run from a saved setting |
| `GET /quiz-settings/:id/quizzes/:quizId` | Full run breakdown (per-question results) |

### `/boards/:boardId/quizzes` (authenticated)

| Route | Purpose |
|---|---|
| `GET /quizzes` | List runs for the board (summary, includes `createdAt` for charts) |
| `POST /quizzes` | Record a one-off run |
| `POST /quizzes/generate` | Generate questions for a play session (respects tags/style/include-known) |
| `DELETE /quizzes` | Delete all runs on the board |
| `GET /quizzes/:quizId` | Run breakdown |

---

## Backend services

The services layer is where the real behavior lives:

| Service | Responsibility |
|---|---|
| `authService` | Register/login/verify/reset orchestration, refresh-token exchange |
| `jwtService` | Wraps `jsonwebtoken`; mints access (1h), refresh (30d), email (24h) tokens; embeds `password_it` for session revocation |
| `passwordHasher` / `passwordService` | bcrypt hashing + password strength validation |
| `userService` | Profile read/update; **separate** password-change and account-deletion flows (both gated on a verified email) |
| `verificationService` | Stateless email-verification code flow (JWT-as-OTP) |
| `passwordResetService` | Reset-token lifecycle (one live token per user) |
| `disposableEmailChecker` | Rejects signups from known disposable-email domains |
| `mailer` | Wraps nodemailer; sends verification/reset email |
| `boardService` / `conceptService` / `tagService` / `logService` | Per-resource CRUD; list queries return summary only, detail returns full columns |
| `quizSettingsService` | Saved-settings CRUD, tag-filter add/remove |
| `quizService` | Question generation (MC/true-false/fill-in), distractor picking (3 random per question, O(n)), run recording, run breakdown, activity-log feeds |
| `matching` | Answer matching: normalization, Levenshtein, lenient (typo-tolerant) vs. exact |
| `cache` | Upstash Redis client; per-(user,board) keys, 30m TTL, board-wide invalidation, fail-open, hit/miss logging for Datadog |
| `logger` | Structured JSON logger with Datadog trace/span injection for non-request code |
| `AppError` | Error with an HTTP status + machine-readable `code` (e.g. `EMAIL_NOT_VERIFIED`) |

---

## Frontend

**Pages** (routes in `src/routes.tsx`):

- Public: `Landing` (`/`), `Demo` (`/demo`), `Login`, `Signup`, `Verify`, `ForgotPassword`, `ResetPassword`
- App (`/app/*`, behind `RequireAuth`): `Dashboard`, `UserSettings`, `Profile`, `NewBoard`, `BoardDetail`, `BoardSettings`, `AllConcepts`, `AllTags`, `Sessions`, `SessionDetail`, `SessionPlay`, `Logs`, `ConceptDetail`

**Contexts** — `AuthContext` (session restore, login/logout, refresh), `BoardContext`, `ConceptContext` (incl. mastery thresholds), `TagContext`, `SessionContext`, `LogContext`, and `ThemeContext` (saved app theme, with a `SystemTheme` override so public pages follow `prefers-color-scheme`).

**API clients** (`lib/api/`) — a shared `client.ts` (credentials-included fetch, single-flight token refresh on 401, Cloudflare-challenge auto-reload, typed `ApiError`) plus per-resource modules: `auth`, `users`, `boards`, `concepts`, `tags`, `logs`, `quizSettings`, `sessions`, `quizzes`.

**Demo** (`app/demo/`) — a full client-side simulation of the app (dashboard, boards, concepts, tags, sessions, settings, quiz play) seeded with a fake user and a "Basic Coding Principles" board. All data lives in `localStorage`; CSV upload and profile settings are disabled there.

---

## Security model

- **httpOnly JWT cookies** — access + refresh tokens never touch JavaScript.
- **Row-level security everywhere** — every table has `FORCE RLS`; the authenticated user id is published via `set_config('app.current_user_id', …)` per request, so even a bug in app code can't leak another user's rows.
- **Restricted DB role** — the app connects as `learninglogs_app`, not the owner.
- **Email verification gates permanent actions** — password resets, password changes, and account deletion all require a verified email (enforced on both the frontend and backend).
- **Session revocation on password change** — `password_it` bumps and is embedded in every token, so old sessions die instantly.
- **Password strength** — minimum length, capital letter, special character.
- **Disposable-email blocking** — signups from throwaway domains are rejected.
- **CSRF posture** — same-site cookies behind a single origin; nginx forwards cookies unchanged.

---

## Testing

- **Unit tests** (`npm run test:unit`) — Jest; services tested in isolation with mocked repositories/cache.
- **Integration tests** (`npm run test:integration`) — Jest + Supertest against a **real PostgreSQL** (provisioned with the restricted RLS role + schema in `globalSetup`), exercising the API end-to-end as the app role so RLS is verified too.
- **CI** runs both suites on every PR and every push to `master`, plus frontend lint and build (which typechecks).

---

## Deployment & infrastructure

- **Dev:** `docker-compose.dev.yaml` — hot-reloaded backend (`node --watch`) + Vite HMR frontend, with bind-mounts.
- **Test:** `docker-compose.test.yaml` — backend test image runs both Jest suites (no frontend).
- **Prod:** images are built in CI (`release.yml`) and pushed to **GHCR**, then pulled on the EC2 box by a **self-hosted GitHub Actions runner** installed on the server — no inbound SSH needed for deploys.
- **Routing:** nginx serves the SPA and proxies `/auth|users|boards/*` to the backend. Cloudflare **Full (strict)** TLS uses a free Cloudflare Origin Certificate mounted into the nginx container.
- **Database:** Neon (Postgres). The prod container runs `npm run db:setup` on start — an idempotent (`IF NOT EXISTS`) migration that provisions the schema automatically on a fresh deployment without touching data.
- **Rate limiting:** Cloudflare WAF rules (20 req/10s for auth paths, 60 req/10s for others) instead of a token-bucket implementation in the app.

---

## Observability

- **Datadog Agent** runs as a container on the EC2 host, collecting every container's logs and receiving APM traces from the backend over a shared unix socket (`DD_APM_RECEIVER_SOCKET`). Site: `datadoghq.com`.
- **Backend** initializes `dd-trace` before anything else, writes one structured JSON log line per request (method, URL, status, duration + `dd.trace_id`/`dd.span_id`), and the `logger` service does the same for non-request code.
- **Cache hit/miss tracking** — `services/cache.js` logs `Cache lookup` entries with `{ cache: { status: 'hit'|'miss', route } }` for every cached endpoint (concepts, tags, logs, quiz settings, quiz runs), so Datadog can graph cache effectiveness per route.

---

## My goals & reasons — EDIT ME

> **This section is yours.** Fill in your own words: why you wanted to create this project, what you're trying to learn, and the reasoning behind the technology choices above.

### Why I wanted to create this project

<!-- TODO: Write your own story here. What motivated you to build Learning Logs? Was it a personal pain point in how you study? A way to practice prompt engineering? A portfolio piece? -->

### Goals

<!-- TODO: What did you set out to achieve? What does "done" look like for you? -->

### Why these technologies

<!-- TODO: Walk through your reasoning for the stack. Why PostgreSQL over a document DB? Why JWT cookies over sessions? Why Redis/Upstash? Why React+Vite+Tailwind? Why EC2 + Cloudflare + GHCR? Why Datadog? What alternatives did you weigh, and what made you land here? -->

---

## Local development

**Prereqs:** Docker + Docker Compose. Secrets go in `backend/.env` (see `.env.example` style entries: `DATABASE_URL`, `DATABASE_ADMIN_URL`, `JWT_*`, `SMTP_*`, `UPSTASH_REDIS_REST_*`, `FRONTEND_ORIGIN`).

```bash
# 1. Start the dev stack (backend :3000, frontend :5173)
docker compose -f docker-compose.dev.yaml up -d --build

# 2. First-time database setup (creates the RLS role + schema)
docker compose -f docker-compose.dev.yaml exec backend npm run db:role
docker compose -f docker-compose.dev.yaml exec backend npm run db:setup

# 3. Open http://localhost:5173
```

**Run tests locally:**

```bash
cd backend
npm run test:unit          # unit tests
npm run test:integration   # integration tests (needs a local Postgres / test env)
```
