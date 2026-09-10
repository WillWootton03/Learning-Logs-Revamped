# Design — Alternate Answers & Question Direction

Status: **Approved** — decisions confirmed 2026-09-08 (see [Confirmed decisions](#confirmed-decisions)). Not yet implemented.
Date: 2026-09-08
Related: `DESIGN.md`, `backend/db/schema.sql`, `backend/services/quizService.js`, `frontend/react-ts/src/app/components/SessionModal.tsx`

---

## Confirmed decisions

1. **"Description" = `prompt`.** No new description column. Reverse shows `answer` and asks for the `prompt`.
2. **Alternates editable everywhere**: CSV column **and** the per-concept editor (`AddConceptModal` + `ConceptDetail` staged editor) and its demo mirrors.
3. **True/false reverse allowed** in mirrored form (statement = candidate prompt).
4. **History records direction**: `quiz.reversed` persisted and surfaced as a chip in `SessionDetail` (real + demo).

---

## Overview

Two related changes to the quiz engine:

1. **Alternate answers** — a concept can carry its own list of *alternate answers*. In multiple-choice questions the three distractors come from that list (3 randomly picked + the real answer) when enough alternates exist; otherwise we keep today's behavior of random answers from the concept pool.
2. **Question direction** — a session-setting flag that flips which side of a flashcard is shown:
   - **Forward** (default, unchanged): show the question/description, recall the answer.
   - **Reverse**: show the answer, recall the question/description it belongs to.

Both changes touch the real app **and** the client-side demo so they stay in parity.

---

## Terminology

A concept is a flashcard pair. We use the backend field names:

| Backend field | Shown as… | Role |
|---|---|---|
| `prompt` | the "question" / description | shown **forward**, recalled **reverse** |
| `answer` | the answer | shown **reverse**, recalled **forward** |
| `alternates` | (new) alternate answers | distractor source for forward MC |

(On the frontend `prompt` is surfaced as `title`. The word "description" in the request maps to `prompt` — confirmed, see [Confirmed decisions](#confirmed-decisions).)

---

## Feature 1 — Alternate answers

### Data model

```sql
-- schema.sql (idempotent; Neon gets it automatically via db:setup)
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS alternates TEXT[] NOT NULL DEFAULT '{}';
```

- **Array column** on `concepts`, not a child table. Reasoning: alternates are read-only quiz input, never queried relationally, and an array keeps CSV import + concept create/update to one row per concept. `pg` returns arrays natively and the value serializes cleanly into the Redis cache JSON.
- No RLS changes — the column rides the existing `concepts` policy.
- Validation caps: each alternate ≤ 500 chars (same as answer), ≤ 20 alternates, trimmed, de-duplicated (case/space-insensitive, matching `normalize()`).

### Backend

| File | Change |
|---|---|
| `repositories/conceptRepository.js` | `create` / `update` / `findById` / list column lists include `alternates`. List (summary) queries **omit** alternates to keep cached payloads small; detail includes them. `importMany` insert includes the column. |
| `services/conceptService.js` | `validateAlternates()` (type, trim, dedupe, length/count caps). `create`/`update` accept optional `alternates`. `importMany` rows accept `alternates?: string[] \| string` (string split on `|` for API callers; CSV parser sends an array). |
| `services/quizService.js` | `buildQuestion()` for MC picks distractors from the concept's alternates when ≥ 3 usable ones exist, else falls back to the pool (today's `pickDistractors`). |

Distractor logic (MC, forward):

```
alts = concept.alternates cleaned + deduped, excluding anything equal to the real answer
if alts.length >= 3:
    distractors = 3 random picks from alts
else:
    distractors = pickDistractors(pool, 3)          # existing random behavior
options = shuffle([real answer, ...distractors])
```

- **Fallback rule**: if fewer than 3 usable alternates remain after cleaning/deduping/excluding the real answer, distractors fall back entirely to random pool answers — exactly the requested "if fewer than 3, pick random answers". Only a concept with **≥ 3 usable alternates** uses its own list.
- Scoring is untouched: the correct option is still `concept.answer`.

### Frontend (real app + demo)

| File | Change |
|---|---|
| `types.ts` / `demo/demoData.ts` | `Concept.alternates: string[]`, `DemoConcept` same. |
| `lib/api/concepts.ts`, `lib/api/client` models | map `alternates` to/from the API; include in create/update/import payloads. |
| `components/CSVUploadModal.tsx` | new **Alternates** column + parser + template + preview chips. |
| `context/ConceptContext.tsx` | pass alternates through create/import/update. |
| `AddConceptModal` / `ConceptDetail` (staged editor) | inline "alternate answers" list editor (add/remove). |
| Demo mirrors | `demo/useDemoStore.ts`, `DemoModals.tsx` (DemoAddConceptModal), `DemoViews.tsx`. CSV stays disabled in demo. |

### CSV format

Column order becomes: **prompt, answer, hint, alternates, tags**.

- `alternates` is pipe-separated inside one cell: `alt one|alt two|alt three` (pipes, because answers may contain commas; quoting optional).
- **Parser is header-aware**: when the first row names an `alternates` column, parse positionally `prompt[0] answer[1] hint[2] alternates[3] tags[4..]`. Header-less or legacy 4-column files keep today's behavior (`prompt,answer,hint,tags`, everything after hint = tags) so existing CSVs still import.
- Downloadable template + format guide updated.

---

## Feature 2 — Question direction

### Data model

```sql
ALTER TABLE quiz_settings ADD COLUMN IF NOT EXISTS reversed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE quiz ADD COLUMN IF NOT EXISTS reversed BOOLEAN NOT NULL DEFAULT false;
```

- `quiz_settings.reversed` — the persisted session-setting toggle (only set in session settings, as requested).
- `quiz.reversed` — **copied onto the run** when it's recorded, so history (`SessionDetail`) can label and reproduce the orientation even for runs whose setting was later changed or deleted. One-off runs accept `reversed` in the request; settings-linked runs inherit it from the setting (like `exact_matching` today).

### Semantics per style

A question has a **stem** (shown to the user) and a **target** (what they must produce/choose). Direction swaps them:

| Style | Forward (default) | Reverse |
|---|---|---|
| multiple_choice | stem = `prompt`; options are **answers** (real + distractors) | stem = `answer`; options are **prompts** from other concepts in the pool (real prompt + 3 random other prompts) |
| fill_in | stem = `prompt`; user types the **answer** | stem = `answer`; user types the **prompt** |
| true_false | statement is a candidate **answer** ("is this the right answer?") | statement is a candidate **prompt** ("is this the right question/description?") |

- MC distractors in reverse come from **other concepts' prompts** — a concept's own `alternates` are answer-side and never used as prompt distractors.
- Correctness always compares the submitted value against the concept's **target** side (`answer` forward, `prompt` reverse), with the existing lenient/exact matching rule applied to whichever side is typed.

### Backend

| File | Change |
|---|---|
| `services/quizSettingsService.js` + repo | `create`/`update` accept + persist `reversed` (boolean validation mirrors `exact_matching`). |
| `services/quizService.js` | `generateQuestions()` accepts `reversed`. `buildQuestion()` uses the orientation to build stems/options/statements and adds `reversed: true` to each question payload. `persistRun()`/`scoreAnswer()` compare against the target side; run insert stores `reversed`. `recordRunFromSettings` takes `reversed` from the setting; `recordRun` accepts an optional `reversed`. |
| controllers / routes | `/boards/:boardId/quizzes/generate` accepts `reversed`. Nothing else changes at the route level. |
| repositories | `quizRepository` persists `reversed` on run insert + returns it on `findRunById`; `quizSettingsRepository` CRUD includes the column. |

The server remains the authoritative scorer — the client only needs `reversed` on each question to label/reveal locally.

### Frontend (real app + demo)

| File | Change |
|---|---|
| `types.ts` | `SessionPreset.reversed: boolean`; `QuizQuestion.reversed?: boolean`. `SessionRecord.reversed` (display only). |
| `components/SessionModal.tsx` | "Question direction" control in the settings editor (default forward). Persisted through preset create/update. |
| `lib/api/quizSettings.ts`, `SessionContext.tsx` | map + persist `reversed`. |
| `pages/SessionPlay.tsx` | pass `reversed` into `generateQuestions`; label/reveal per orientation; MC/TF/fill-in compare against the target side. |
| `pages/SessionDetail.tsx` | show direction chip + correct labeling. |
| `Demo` mirrors | `demo/demoData.ts` (`DemoPreset.reversed`, runs), `demo/DemoModals.tsx` (DemoNewSettingModal / DemoStartSessionModal), `demo/DemoQuiz.tsx` (generation + scoring), `demo/DemoViews.tsx` (session detail row), `Demo.tsx` recordRun plumbing. |

---

## Testing

- Unit (`quizService`): distractor choice — alternates ≥ 3 uses only alternates; 1–2 tops up from pool; none = pure pool. Direction — question payloads flipped per style; scoring against the correct target side.
- Unit (`conceptService`): alternate validation caps/dedupe; import parse.
- Integration: create concept with alternates → GET detail returns them; CSV-style import persists them; generate MC returns real answer among options; reversed run scores against the prompt; `quiz.reversed` survives breakdown read-back.
- CSV parser: header with `alternates`; legacy 4-col file still imports; quoted pipe cells.

---

## Out of scope (for now)

- Alternate **prompts** (reverse-mode distractors) — reverse MC always uses pool prompts.
- Weighting/learned-aware alternates.
- Editing alternates from the board "settings" mass UI.
