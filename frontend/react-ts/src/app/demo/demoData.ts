/**
 * Demo-mode data model + seed data.
 *
 * The demo page is fully self-contained: no backend, no auth. All state lives
 * in localStorage under DEMO_STORAGE_KEY so the fake user's boards, concepts,
 * tags, and session settings survive a refresh but never touch the API.
 */

export type DemoUser = {
  name: string;
  email: string;
};

export type DemoBoard = {
  id: string;
  title: string;
  subject: string;
  color: string;
  masteryThreshold: number;
};

export type DemoTag = {
  id: string;
  boardId: string;
  name: string;
};

export type DemoConcept = {
  id: string;
  boardId: string;
  title: string;
  answer: string;
  hint: string | null;
  learned: boolean;
  tagIds: string[];
  lastReviewed: string | null;
};

export type DemoPreset = {
  id: string;
  boardId: string;
  name: string;
  style: "true_false" | "multiple_choice" | "fill_in";
  includeKnown: boolean;
  tagIds: string[] | null;
  matchAllTags: boolean;
  exactMatching: boolean;
};

export type DemoRunResult = {
  conceptId: string;
  correct: boolean;
};

export type DemoRun = {
  id: string;
  boardId: string;
  presetName: string;
  style: "true_false" | "multiple_choice" | "fill_in";
  includeKnown: boolean;
  tagIds: string[] | null;
  matchAllTags: boolean;
  exactMatching: boolean;
  correctCount: number;
  conceptsStudied: number;
  /** Raw elapsed time in ms — used to compute totals without parsing a label. */
  timeElapsedMs: number;
  createdAt: string;
  /** Per-concept results so the session detail view can show a breakdown. */
  results: DemoRunResult[];
};

export type DemoState = {
  user: DemoUser;
  boards: DemoBoard[];
  tags: DemoTag[];
  concepts: DemoConcept[];
  presets: DemoPreset[];
  runs: DemoRun[];
};

export const DEMO_STORAGE_KEY = "learninglogs-demo-v2";

let idCounter = 0;
function nid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** ISO timestamp `n` days ago at a fixed hour (used to seed the run chart). */
function daysAgo(n: number, hour = 19): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

function makeState(): DemoState {
  const boardId = nid("board");

  const tagVariables = nid("tag");
  const tagFunctions = nid("tag");
  const tagControlFlow = nid("tag");
  const tagDataTypes = nid("tag");
  const tagArrays = nid("tag");

  const tags: DemoTag[] = [
    { id: tagVariables, boardId, name: "variables" },
    { id: tagFunctions, boardId, name: "functions" },
    { id: tagControlFlow, boardId, name: "control-flow" },
    { id: tagDataTypes, boardId, name: "data-types" },
    { id: tagArrays, boardId, name: "arrays" },
  ];

  const concept = (
    title: string,
    answer: string,
    learned: boolean,
    tagIds: string[],
    hint: string | null = null,
    reviewedDaysAgo: number | null = null
  ): DemoConcept => ({
    id: nid("concept"),
    boardId,
    title,
    answer,
    hint,
    learned,
    tagIds,
    lastReviewed: reviewedDaysAgo === null ? null : daysAgo(reviewedDaysAgo, 18),
  });

  const concepts: DemoConcept[] = [
    concept("What is a variable?", "A named container that stores a value in memory.", true, [tagVariables, tagDataTypes], "Think of it as a labeled box.", 0),
    concept("What does a function do?", "A reusable block of code that performs a task and can return a value.", true, [tagFunctions], "It packages work so you can call it by name.", 1),
    concept("What is a loop?", "A construct that repeats a block of code while a condition holds.", true, [tagControlFlow], "Repeats until the condition is false.", 2),
    concept("What is an array?", "An ordered collection of items, accessible by index.", true, [tagArrays, tagDataTypes], "Zero-based index — first item is [0].", 3),
    concept("What is a boolean?", "A data type with exactly two values: true and false.", true, [tagDataTypes], "The basis of all conditionals.", 4),
    concept("What is an if statement?", "Runs a block of code only if a condition evaluates to true.", true, [tagControlFlow], "Branches the program.", 5),
    concept("What is a string?", "A sequence of characters used to represent text.", false, [tagDataTypes], "Usually quoted: \"hello\".", 6),
    concept("What is a function parameter?", "A named input a function receives when it is called.", false, [tagFunctions], "Local to the function's body."),
    concept("What is scope?", "The region of a program where a variable is accessible.", false, [tagVariables], "Global vs function vs block scope."),
    concept("What is an object?", "A collection of key-value pairs.", false, [tagDataTypes], "Groups related data together."),
    concept("What is recursion?", "A function that calls itself until it reaches a base case.", false, [tagFunctions, tagControlFlow], "Each call shrinks the problem."),
    concept("What is a hash map?", "A structure that stores key-value pairs with near O(1) lookups.", false, [tagArrays, tagDataTypes], "Trades memory for speed."),
  ];

  const presets: DemoPreset[] = [
    {
      id: nid("preset"),
      boardId,
      name: "Quick review",
      style: "multiple_choice",
      includeKnown: false,
      tagIds: null,
      matchAllTags: false,
      exactMatching: false,
    },
    {
      id: nid("preset"),
      boardId,
      name: "Fundamentals drill",
      style: "true_false",
      includeKnown: true,
      tagIds: null,
      matchAllTags: false,
      exactMatching: false,
    },
    {
      id: nid("preset"),
      boardId,
      name: "Typing practice",
      style: "fill_in",
      includeKnown: false,
      tagIds: [tagDataTypes],
      matchAllTags: false,
      exactMatching: true,
    },
  ];

  // Seed a week of sessions so the accuracy chart has bars to show. Each run
  // carries per-concept results so its detail view can render a breakdown,
  // plus a snapshot of the settings it was played with.
  const seededRuns: [number, number, DemoRun["style"], boolean, string, number][] = [
    [5, 5, "multiple_choice", true, "Quick review", 6],
    [3, 5, "true_false", true, "Fundamentals drill", 5],
    [4, 5, "multiple_choice", false, "Quick review", 4],
    [6, 8, "fill_in", false, "Typing practice", 3],
    [5, 6, "true_false", true, "Fundamentals drill", 2],
    [7, 8, "multiple_choice", false, "Quick review", 1],
    [4, 5, "multiple_choice", false, "Quick review", 0],
  ];
  const presetByName = new Map(presets.map((p) => [p.name, p]));
  const runs: DemoRun[] = seededRuns.map(([correct, studied, style, includeKnown, presetName, ago]) => {
    const preset = presetByName.get(presetName);
    const pool = [...concepts].sort(() => Math.random() - 0.5);
    const picked = pool.slice(0, studied);
    // Distribute the correct count across the picked concepts.
    const correctSet = new Set(picked.slice(0, correct).map((c) => c.id));
    const results = picked.map((c) => ({ conceptId: c.id, correct: correctSet.has(c.id) }));
    return {
      id: nid("run"),
      boardId,
      presetName,
      style,
      includeKnown,
      tagIds: preset?.tagIds ?? null,
      matchAllTags: preset?.matchAllTags ?? false,
      exactMatching: preset?.exactMatching ?? false,
      correctCount: correct,
      conceptsStudied: studied,
      timeElapsedMs: studied * 30_000 + Math.floor(Math.random() * 90_000),
      createdAt: daysAgo(ago),
      results,
    };
  });

  return {
    user: { name: "Alex Rivera", email: "alex@demo.learninglogs.com" },
    boards: [
      {
        id: boardId,
        title: "Basic Coding Principles",
        subject: "Computer Science",
        color: "#7c6af7",
        masteryThreshold: 3,
      },
    ],
    tags,
    concepts,
    presets,
    runs,
  };
}

/** Load the persisted demo state, seeding it the first time. */
export function loadDemoState(): DemoState {
  if (typeof window === "undefined") return makeState();
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed && Array.isArray(parsed.boards)) return parsed;
    }
  } catch {
    // Corrupt or unavailable storage — fall through to a fresh seed.
  }
  return makeState();
}

/** Persist demo state. Failures are swallowed (demo only). */
export function saveDemoState(state: DemoState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota or availability — nothing to do.
  }
}

/** Discard the stored demo state so the next load reseeds. */
export function clearDemoState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
