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
  quiz_settings_id: string | null;
  questions_count: number;
  /** BIGINT — pg returns it as a string, hence the string type here. */
  time_elapsed_ms: string;
  correct_count: number;
  created_at: string;
  settings_name: string | null;
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

/** Delete every quiz run (session history) on a board. */
export function deleteAllRuns(boardId: string) {
  return request<{ deleted: number }>(`/boards/${boardId}/quizzes`, {
    method: "DELETE",
  });
}
