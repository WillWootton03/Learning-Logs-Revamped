import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Concept } from "../types";
import {
  createConcept as apiCreateConcept,
  createTags,
  deleteAllConcepts as apiDeleteAllConcepts,
  deleteAllTags as apiDeleteAllTags,
  deleteConcept as apiDeleteConcept,
  importConcepts as apiImportConcepts,
  linkTags,
  listConcepts,
  listTags,
  setConceptLearned as apiSetConceptLearned,
  updateConcept as apiUpdateConcept,
  type ImportConceptRow,
} from "../lib/api";
import { useBoard } from "./BoardContext";
import { useTags } from "./TagContext";

type ConceptState = {
  /** Concepts per board, keyed by board id. */
  concepts: Record<string, Concept[]>;
  loadConcepts: (boardId: string) => Promise<void>;
  createConcept: (boardId: string, input: { prompt: string; answer: string; tags: string[] }) => Promise<Concept>;
  /** Persist an edit to a concept's title/answer on the backend, then update local state. */
  updateConcept: (
    boardId: string,
    conceptId: string,
    changes: { title?: string; answer?: string; hint?: string | null }
  ) => Promise<void>;
  /** Persist a concept's learned status on the backend, then update local state. */
  setConceptLearned: (boardId: string, conceptId: string, learned: boolean) => Promise<void>;
  /** Local, non-persisted add — used by flows that manage persistence themselves. */
  addConcept: (boardId: string, concept: Concept) => void;
  updateConceptTags: (boardId: string, conceptId: string, tags: string[]) => void;
  /**
   * Bulk-import concepts (and their tags) from CSV-derived rows. Appends the
   * created concepts to local state so the page updates without a refetch.
   */
  importConcepts: (boardId: string, rows: ImportConceptRow[]) => Promise<Concept[]>;
  /** Persist a concept's deletion on the backend, then remove it locally. */
  deleteConcept: (boardId: string, conceptId: string) => Promise<void>;
  /** Delete every concept on a board, then clear the local list. */
  deleteAllConcepts: (boardId: string) => Promise<void>;
  /** Delete every tag on a board, clearing tags from concepts + the tag pool. */
  deleteAllTags: (boardId: string) => Promise<void>;
};

const ConceptContext = createContext<ConceptState | null>(null);

export function ConceptProvider({ children }: { children: ReactNode }) {
  const { boards, updateBoardStats } = useBoard();
  const { seedBoardTags, clearBoardTags } = useTags();
  const [concepts, setConcepts] = useState<Record<string, Concept[]>>({});

  // Mastery thresholds mirrored into a ref so loadConcepts stays a stable
  // callback. If it depended on `boards` directly, every boards update would
  // give it a new identity and re-trigger the board page's fetch effect.
  const thresholdsRef = useRef<Record<string, number>>({});
  // boardId → resolvers for loadConcepts calls that raced ahead of the boards
  // fetch. When boards arrive we resolve them so those loads proceed instead
  // of silently bailing (which left pages stuck on "no concepts" until a
  // manual reload).
  const thresholdWaitersRef = useRef<Map<string, Array<(t: number) => void>>>(new Map());

  useEffect(() => {
    thresholdsRef.current = Object.fromEntries(boards.map((b) => [b.id, b.masteryThreshold]));
    const waiters = thresholdWaitersRef.current;
    for (const [boardId, resolvers] of waiters) {
      const threshold = thresholdsRef.current[boardId];
      if (threshold !== undefined) {
        waiters.delete(boardId);
        for (const resolve of resolvers) resolve(threshold);
      }
    }
  }, [boards]);

  // Board summary counts (conceptCount / conceptsLearned) are derived from the
  // loaded concept lists. Keeping this in one place means every mutation just
  // updates the list and the aggregates stay correct — no manual bookkeeping
  // in each mutator.
  useEffect(() => {
    for (const boardId of Object.keys(concepts)) {
      const list = concepts[boardId] ?? [];
      updateBoardStats(boardId, {
        conceptCount: list.length,
        conceptsLearned: list.filter((c) => c.learned).length,
      });
    }
  }, [concepts, updateBoardStats]);

  /**
   * Resolve with a board's mastery threshold. If the boards fetch hasn't
   * landed yet, this waits for it — but only for a bounded time: a board whose
   * threshold never arrives (e.g. it has no concepts and the boards list is
   * empty) must not hold up the page's concept load forever, or the page
   * spinner never clears. Falls back to 0 (nothing is "learned") after the
   * wait, which is correct for a board with no concepts.
   */
  const waitForThreshold = useCallback((boardId: string): Promise<number> => {
    const threshold = thresholdsRef.current[boardId];
    if (threshold !== undefined) return Promise.resolve(threshold);
    return new Promise((resolve) => {
      const resolvers = thresholdWaitersRef.current.get(boardId) ?? [];
      resolvers.push(resolve);
      thresholdWaitersRef.current.set(boardId, resolvers);
      // Safety net: if the boards list never loads (or this board is missing
      // from it), don't block the concept load — fall back to no mastery.
      setTimeout(() => {
        const remaining = thresholdWaitersRef.current.get(boardId) ?? [];
        const idx = remaining.indexOf(resolve);
        if (idx !== -1) {
          remaining.splice(idx, 1);
          if (remaining.length === 0) thresholdWaitersRef.current.delete(boardId);
          resolve(0);
        }
      }, 2000);
    });
  }, []);

  /** Load a board's concepts, computing "learned" against its mastery
   *  threshold, and prime the tag pool with every tag seen. */
  const loadConcepts = useCallback(
    async (boardId: string) => {
      const masteryThreshold = await waitForThreshold(boardId);
      const rows = await listConcepts(boardId, masteryThreshold);
      setConcepts((prev) => ({ ...prev, [boardId]: rows }));
      seedBoardTags(boardId, rows.flatMap((c) => c.tags));
    },
    [seedBoardTags, waitForThreshold]
  );

  /**
   * Create a concept on the backend and attach its tags. Existing tag names
   * are resolved to ids in one list call, any missing names are batch-created,
   * then every id is batch-linked — no per-tag round trips.
   */
  const createConcept = useCallback(
    async (boardId: string, input: { prompt: string; answer: string; tags: string[] }) => {
      const board = boards.find((b) => b.id === boardId);
      if (!board) throw new Error("Board not found");
      const row = await apiCreateConcept(boardId, {
        prompt: input.prompt,
        answer: input.answer,
      });
      const tagNames = Array.from(new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)));

      if (tagNames.length > 0) {
        const boardTags = await listTags(boardId);
        const byName = new Map(boardTags.map((t) => [t.name.toLowerCase(), t.tag_id]));
        const existingIds = tagNames.map((n) => byName.get(n)).filter((id): id is string => Boolean(id));
        const newNames = tagNames.filter((n) => !byName.has(n));
        const created = newNames.length > 0 ? await createTags(boardId, newNames) : [];
        const tagIds = [...existingIds, ...created.map((t) => t.tag_id)];
        await linkTags(boardId, row.concept_id, tagIds);
      }

      const concept: Concept = {
        id: row.concept_id,
        title: row.prompt,
        answer: row.answer,
        hint: null,
        learned: row.times_answered_correctly >= board.masteryThreshold,
        tags: tagNames,
        lastReviewed: null,
      };
      setConcepts((prev) => ({ ...prev, [boardId]: [...(prev[boardId] ?? []), concept] }));
      seedBoardTags(boardId, tagNames);
      return concept;
    },
    [boards, seedBoardTags]
  );

  function addConcept(boardId: string, concept: Concept) {
    setConcepts((prev) => ({ ...prev, [boardId]: [...(prev[boardId] ?? []), concept] }));
  }

  /**
   * Bulk-import concepts with their tags and append them to local state.
   * The backend returns the created rows (including tags), so the imported
   * concepts can be mapped straight onto the Concept model and merged in —
   * no refetch needed.
   */
  const importConcepts = useCallback(
    async (boardId: string, rows: ImportConceptRow[]): Promise<Concept[]> => {
      const createdRows = await apiImportConcepts(boardId, rows);
      const masteryThreshold = thresholdsRef.current[boardId] ?? 0;
      const created: Concept[] = createdRows.map((row) => ({
        id: row.concept_id,
        title: row.prompt,
        answer: row.answer,
        hint: row.hint ?? null,
        learned: row.times_answered_correctly >= masteryThreshold,
        tags: row.tags ?? [],
        lastReviewed: null,
      }));
      setConcepts((prev) => ({ ...prev, [boardId]: [...(prev[boardId] ?? []), ...created] }));
      seedBoardTags(boardId, created.flatMap((c) => c.tags));
      return created;
    },
    [seedBoardTags]
  );

  const updateConcept = useCallback(
    async (
      boardId: string,
      conceptId: string,
      changes: { title?: string; answer?: string; hint?: string | null }
    ) => {
      const row = await apiUpdateConcept(boardId, conceptId, {
        prompt: changes.title,
        answer: changes.answer,
        ...(changes.hint !== undefined ? { hint: changes.hint } : {}),
      });
      setConcepts((prev) => ({
        ...prev,
        [boardId]: (prev[boardId] ?? []).map((c) =>
          c.id === conceptId
            ? {
                ...c,
                title: row.prompt,
                answer: row.answer,
                ...(row.hint !== undefined ? { hint: row.hint } : {}),
              }
            : c
        ),
      }));
    },
    []
  );

  function updateConceptTags(boardId: string, conceptId: string, tags: string[]) {
    setConcepts((prev) => ({
      ...prev,
      [boardId]: (prev[boardId] ?? []).map((c) => (c.id === conceptId ? { ...c, tags } : c)),
    }));
  }

  /** Persist a learned-status change and mirror the new counter in local state. */
  const setConceptLearned = useCallback(
    async (boardId: string, conceptId: string, learned: boolean) => {
      const row = await apiSetConceptLearned(boardId, conceptId, learned);
      setConcepts((prev) => ({
        ...prev,
        [boardId]: (prev[boardId] ?? []).map((c) =>
          c.id === conceptId
            ? { ...c, learned: row.times_answered_correctly >= (thresholdsRef.current[boardId] ?? 0) }
            : c
        ),
      }));
    },
    []
  );

  async function deleteConcept(boardId: string, conceptId: string) {
    await apiDeleteConcept(boardId, conceptId);
    setConcepts((prev) => ({
      ...prev,
      [boardId]: (prev[boardId] ?? []).filter((c) => c.id !== conceptId),
    }));
  }

  /** Delete every concept on the board, then clear the local list. */
  const deleteAllConcepts = useCallback(async (boardId: string) => {
    await apiDeleteAllConcepts(boardId);
    setConcepts((prev) => ({ ...prev, [boardId]: [] }));
  }, []);

  /** Delete every tag on the board: strip tags from concepts + clear the pool. */
  const deleteAllTags = useCallback(
    async (boardId: string) => {
      await apiDeleteAllTags(boardId);
      setConcepts((prev) => ({
        ...prev,
        [boardId]: (prev[boardId] ?? []).map((c) => ({ ...c, tags: [] })),
      }));
      clearBoardTags(boardId);
    },
    [clearBoardTags]
  );

  return (
    <ConceptContext.Provider
      value={{
        concepts,
        loadConcepts,
        createConcept,
        updateConcept,
        setConceptLearned,
        addConcept,
        updateConceptTags,
        importConcepts,
        deleteConcept,
        deleteAllConcepts,
        deleteAllTags,
      }}
    >
      {children}
    </ConceptContext.Provider>
  );
}

export function useConcepts() {
  const ctx = useContext(ConceptContext);
  if (!ctx) throw new Error("useConcepts must be used inside ConceptProvider");
  return ctx;
}
