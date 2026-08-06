/**
 * Quiz engine API — /boards/:boardId/quizzes and
 * /boards/:boardId/quiz-settings/:quizSettingsId/quizzes.
 *
 * The server generates the questions for a session (single style per run) and
 * is the authoritative scorer: on completion the client sends back the answers
 * and the server stores the run, records per-question results, and bumps
 * mastery for correct concepts.
 */
import { request } from "./client";

export type QuizStyle = "true_false" | "multiple_choice" | "fill_in";

/** A generated question. `options` is present for multiple_choice, `statement`
 * for true_false; fill_in carries only the base fields. */
export type QuizQuestion = {
  conceptId: string;
  prompt: string;
  hint: string | null;
  /** multiple_choice — includes the correct answer among the options. */
  options?: string[];
  /** true_false — the statement to judge. The expected answer is NOT sent. */
  statement?: string;
};

/** One submitted answer. TF echoes `statement` so the server can re-score it. */
export type QuizAnswer = {
  conceptId: string;
  /** Selected option text (MC), typed answer (fill_in), or true/false (TF). */
  response: string | boolean;
  /** TF only: the statement shown to the user. */
  statement?: string;
};

export type QuizScoredResult = {
  conceptId: string;
  answeredCorrectly: boolean;
};

/** Generate a quiz's questions for a board. `matchAllTags` flips the tag
 * filter from "any selected tag" to "every selected tag". */
export async function generateQuestions(
  boardId: string,
  params: {
    style: QuizStyle;
    tagIds?: string[] | null;
    includeKnown?: boolean;
    questionCount?: number;
    matchAllTags?: boolean;
  }
): Promise<QuizQuestion[]> {
  const res = await request<{ questions: QuizQuestion[] }>(`/boards/${boardId}/quizzes/generate`, {
    method: "POST",
    body: JSON.stringify({
      style: params.style,
      tagIds: params.tagIds ?? undefined,
      includeKnown: params.includeKnown ?? false,
      questionCount: params.questionCount,
      matchAll: params.matchAllTags ?? false,
    }),
  });
  return res.questions;
}

/** Record a completed run linked to a saved setting. Scoring mode (lenient
 * vs. exact) is read from the persisted setting server-side. */
export async function recordRunFromSettings(
  boardId: string,
  settingsId: string,
  data: { timeElapsedMs: number; answers: QuizAnswer[] }
): Promise<{ results: QuizScoredResult[] }> {
  return request(`/boards/${boardId}/quiz-settings/${settingsId}/quizzes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Record a completed one-off run (style passed explicitly). */
export async function recordRun(
  boardId: string,
  data: { style: QuizStyle; timeElapsedMs: number; answers: QuizAnswer[] }
): Promise<{ results: QuizScoredResult[] }> {
  return request(`/boards/${boardId}/quizzes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
