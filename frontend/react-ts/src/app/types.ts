/**
 * Shared domain types for the LearnBoard app.
 *
 * These are the client-side models for the data served by the backend API.
 * Keeping them in one module (instead of inline in a context) lets any page or
 * component import just a type without pulling in a whole context provider.
 */

export type Board = {
  id: string;
  title: string;
  subject: string;
  conceptCount: number;
  conceptsLearned: number;
  sessionCount: number;
  streakDays: number;
  lastUsed: string;
  color: string;
  /** Correct-answer count that marks a concept as learned. */
  masteryThreshold: number;
};

export type Concept = {
  id: string;
  title: string;
  answer: string;
  /** Optional hint shown on the detail page and revealable during a session. */
  hint: string | null;
  learned: boolean;
  tags: string[];
  lastReviewed: string | null;
};

export type SessionPreset = {
  id: string;
  name: string;
  /** Quiz style this setting generates. New presets default to multiple_choice. */
  style: "true_false" | "multiple_choice" | "fill_in";
  includeKnown: boolean;
  /** Tag ids the setting filters by; null means all tags on the board. */
  tagIds: string[] | null;
  /**
   * Tag filter mode. false (default) = a concept with ANY selected tag
   * qualifies; true = it must carry EVERY selected tag. Persisted on the
   * setting and read back into presets / run breakdowns.
   */
  matchAllTags: boolean;
  /**
   * Answer matching mode for fill-in questions. false (default) = lenient
   * (minor typos still count); true = exact after trim/lowercase, no typo
   * tolerance. Persisted on the setting and read back into presets.
   */
  exactMatching: boolean;
};

export type ConceptResult = {
  conceptId: string;
  correct: boolean;
};

export type SessionRecord = {
  id: string;
  boardId: string;
  presetName: string;
  includeKnown: boolean;
  allowedTags: string[] | null;
  conceptsStudied: number;
  correctCount: number;
  duration: string;
  /** Raw elapsed time in ms — used to compute totals without parsing the label. */
  timeElapsedMs: number;
  date: string;
  results: ConceptResult[];
};

export type Log = {
  id: string;
  boardId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};
