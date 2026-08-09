/**
 * Session/quiz API routes — /boards/:boardId/quizzes. Maps backend quiz-run
 * rows (snake_case) onto the frontend SessionRecord model. The list endpoint
 * returns summary only (no per-question results, no preset metadata), so
 * results stays [] and includeKnown/allowedTags default until a detail fetch.
 */
import { request } from "./client";
import type { SessionRecord } from "../../types";

type RunRow = {
  quiz_id: string;
  /** Present on the user-wide activity-log feed only. */
  board_id?: string;
  quiz_settings_id: string | null;
  questions_count: number;
  /** BIGINT — pg returns it as a string, hence the string type here. */
  time_elapsed_ms: string;
  correct_count: number;
  created_at: string;
  settings_name: string | null;
  /** Present on the user-wide activity-log feed only. */
  board_title?: string;
};

/** "3 min" / "45 sec" / "2 min 30 sec" from milliseconds. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} sec`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds} sec`;
}

/** "Aug 4" from an ISO timestamp. */
export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** All quiz runs on a board, newest first. */
export async function listRuns(boardId: string) {
  const res = await request<{ runs: RunRow[] }>(`/boards/${boardId}/quizzes`);
  return res.runs.map((row) => {
    // pg serializes BIGINT (time_elapsed_ms) as a string — coerce to a number.
    const timeElapsedMs = Number(row.time_elapsed_ms);
    return {
      id: row.quiz_id,
      boardId,
      presetName: row.settings_name ?? "One-off quiz",
      includeKnown: false,
      allowedTags: null,
      conceptsStudied: row.questions_count,
      correctCount: row.correct_count,
      duration: formatDuration(timeElapsedMs),
      timeElapsedMs,
      date: formatSessionDate(row.created_at),
      results: [],
    } satisfies SessionRecord;
  });
}

/** The run summary type used by the user-wide activity feed. */
export type ActivityRun = {
  id: string;
  boardId: string;
  boardTitle: string;
  presetName: string;
  conceptsStudied: number;
  correctCount: number;
  timeElapsedMs: number;
  date: string;
  createdAt: string;
};

/** Every quiz run across the user's boards, newest first (activity log feed). */
export async function listAllRuns(): Promise<ActivityRun[]> {
  const res = await request<{ runs: RunRow[] }>(`/users/me/runs`);
  return res.runs
    // Cache entries written before board_id was added are stale; drop them so
    // a click can't navigate to a board-less session. The 30-min TTL (or any
    // new run) refreshes the cache with the board id included.
    .filter((row) => row.board_id)
    .map((row) => ({
      id: row.quiz_id,
      boardId: row.board_id!,
      boardTitle: row.board_title ?? "Unknown board",
      presetName: row.settings_name ?? "One-off quiz",
      conceptsStudied: row.questions_count,
      correctCount: row.correct_count,
      timeElapsedMs: Number(row.time_elapsed_ms),
      date: formatSessionDate(row.created_at),
      createdAt: row.created_at,
    }));
}

// ── Run breakdown (session detail) ─────────────────────────────────────────

type BreakdownRunRow = {
  quiz_id: string;
  quiz_settings_id: string | null;
  questions_count: number;
  /** BIGINT — pg returns it as a string. */
  time_elapsed_ms: string;
  correct_count: number;
  created_at: string;
  settings_name: string | null;
  include_known: boolean | null;
  exact_matching: boolean | null;
  match_all_tags: boolean | null;
  /** Resolved tag-filter names (empty for a one-off run or an unfiltered preset). */
  tag_names: string[];
};

/** One reviewed concept within a run. */
export type SessionDetailResult = {
  conceptId: string;
  /** The concept's prompt as it was when the run was recorded. */
  title: string;
  answer: string;
  hint: string | null;
  tags: string[];
  correct: boolean;
};

/** Full detail for one session: summary + per-question results. */
export type SessionDetail = Omit<SessionRecord, "results"> & {
  /** Setting id this run was created from (null for one-off quizzes). */
  settingsId: string | null;
  /** Whether exact (vs lenient) answer matching was active for fill-in questions. */
  exactMatching: boolean;
  /** Whether the tag filter required every selected tag (vs any). */
  matchAllTags: boolean;
  results: SessionDetailResult[];
};

/**
 * Fetch one run's full breakdown, mapping the backend rows onto the session
 * model the board pages already use. `includeKnown`/`allowedTags` come from
 * the linked setting (a one-off run falls back to unfiltered defaults).
 */
export async function getRunBreakdown(boardId: string, quizId: string): Promise<SessionDetail> {
  const res = await request<{ run: BreakdownRunRow; questions: BreakdownQuestionRow[] }>(
    `/boards/${boardId}/quizzes/${quizId}`
  );
  const run = res.run;
  const timeElapsedMs = Number(run.time_elapsed_ms);
  return {
    id: run.quiz_id,
    boardId,
    settingsId: run.quiz_settings_id,
    presetName: run.settings_name ?? "One-off quiz",
    includeKnown: run.include_known ?? false,
    allowedTags: run.tag_names.length > 0 ? run.tag_names : null,
    conceptsStudied: run.questions_count,
    correctCount: run.correct_count,
    duration: formatDuration(timeElapsedMs),
    timeElapsedMs,
    date: formatSessionDate(run.created_at),
    exactMatching: run.exact_matching ?? false,
    matchAllTags: run.match_all_tags ?? false,
    results: res.questions.map((q) => ({
      conceptId: q.concept_id,
      title: q.prompt,
      answer: q.answer,
      hint: q.hint,
      tags: q.tags,
      correct: q.answered_correctly,
    })),
  };
}

type BreakdownQuestionRow = {
  quiz_question_id: string;
  position: number;
  answered_correctly: boolean;
  concept_id: string;
  prompt: string;
  answer: string;
  hint: string | null;
  tags: string[];
};

/** Delete every quiz run (session history) on a board. */
export function deleteAllRuns(boardId: string) {
  return request<{ deleted: number }>(`/boards/${boardId}/quizzes`, {
    method: "DELETE",
  });
}
