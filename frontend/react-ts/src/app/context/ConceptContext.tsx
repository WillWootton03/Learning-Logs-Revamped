import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Concept } from "../types";
import {
  createConcept as apiCreateConcept,
  createTags,
  linkTags,
  listConcepts,
  listTags,
  updateConcept as apiUpdateConcept,
} from "../lib/api";
import { useBoard } from "./BoardContext";
import { useTags } from "./TagContext";

type ConceptState = {
  /** Concepts per board, keyed by board id. */
  concepts: Record<string, Concept[]>;
  loadConcepts: (boardId: string) => Promise<void>;
  createConcept: (boardId: string, input: { prompt: string; answer: string; tags: string[] }) => Promise<Concept>;
  /** Persist an edit to a concept's title/answer on the backend, then update local state. */
  updateConcept: (boardId: string, conceptId: string, changes: { title?: string; answer?: string }) => Promise<void>;
  /** Local, non-persisted add — used by flows that manage persistence themselves. */
  addConcept: (boardId: string, concept: Concept) => void;
  updateConceptTags: (boardId: string, conceptId: string, tags: string[]) => void;
  toggleConceptLearned: (boardId: string, conceptId: string) => void;
  deleteConcept: (boardId: string, conceptId: string) => void;
};

const ConceptContext = createContext<ConceptState | null>(null);

export function ConceptProvider({ children }: { children: ReactNode }) {
  const { boards, updateBoardStats } = useBoard();
  const { seedBoardTags } = useTags();
  const [concepts, setConcepts] = useState<Record<string, Concept[]>>({});

  // Mastery thresholds mirrored into a ref so loadConcepts stays a stable
  // callback. If it depended on `boards` directly, every boards update would
  // give it a new identity and re-trigger the board page's fetch effect.
  const thresholdsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    thresholdsRef.current = Object.fromEntries(boards.map((b) => [b.id, b.masteryThreshold]));
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

  /** Load a board's concepts, computing "learned" against its mastery
   *  threshold, and prime the tag pool with every tag seen. */
  const loadConcepts = useCallback(
    async (boardId: string) => {
      const masteryThreshold = thresholdsRef.current[boardId];
      if (masteryThreshold === undefined) return;
      const rows = await listConcepts(boardId, masteryThreshold);
      setConcepts((prev) => ({ ...prev, [boardId]: rows }));
      seedBoardTags(boardId, rows.flatMap((c) => c.tags));
    },
    [seedBoardTags]
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

  const updateConcept = useCallback(
    async (boardId: string, conceptId: string, changes: { title?: string; answer?: string }) => {
      const row = await apiUpdateConcept(boardId, conceptId, {
        prompt: changes.title,
        answer: changes.answer,
      });
      setConcepts((prev) => ({
        ...prev,
        [boardId]: (prev[boardId] ?? []).map((c) =>
          c.id === conceptId
            ? { ...c, title: row.prompt, answer: row.answer }
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

  function toggleConceptLearned(boardId: string, conceptId: string) {
    setConcepts((prev) => ({
      ...prev,
      [boardId]: (prev[boardId] ?? []).map((c) => (c.id === conceptId ? { ...c, learned: !c.learned } : c)),
    }));
  }

  function deleteConcept(boardId: string, conceptId: string) {
    setConcepts((prev) => ({
      ...prev,
      [boardId]: (prev[boardId] ?? []).filter((c) => c.id !== conceptId),
    }));
  }

  return (
    <ConceptContext.Provider
      value={{
        concepts,
        loadConcepts,
        createConcept,
        updateConcept,
        addConcept,
        updateConceptTags,
        toggleConceptLearned,
        deleteConcept,
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
