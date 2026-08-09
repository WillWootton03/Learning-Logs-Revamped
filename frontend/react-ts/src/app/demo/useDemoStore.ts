import { useCallback, useEffect, useState } from "react";
import {
  clearDemoState,
  loadDemoState,
  saveDemoState,
  type DemoBoard,
  type DemoConcept,
  type DemoPreset,
  type DemoRun,
  type DemoState,
  type DemoTag,
} from "./demoData";

let idCounter = 0;
function nid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export type DemoStore = {
  state: DemoState;
  /** Persist to localStorage and update in-memory state. */
  setState: (updater: (prev: DemoState) => DemoState) => void;
  createBoard: (input: { title: string; subject: string; color: string }) => DemoBoard;
  updateBoard: (boardId: string, patch: Partial<Omit<DemoBoard, "id">>) => void;
  createTag: (boardId: string, name: string) => DemoTag;
  createConcept: (
    boardId: string,
    input: { title: string; answer: string; hint: string | null; learned: boolean; tagIds: string[] }
  ) => DemoConcept;
  updateConcept: (
    boardId: string,
    conceptId: string,
    patch: { title?: string; answer?: string; hint?: string | null; learned?: boolean; tagIds?: string[] }
  ) => void;
  renameTag: (tagId: string, name: string) => void;
  toggleLearned: (boardId: string, conceptId: string) => void;
  createPreset: (boardId: string, input: Omit<DemoPreset, "id" | "boardId">) => DemoPreset;
  updatePreset: (presetId: string, patch: Partial<Omit<DemoPreset, "id" | "boardId">>) => void;
  deleteBoard: (boardId: string) => void;
  deleteTag: (tagId: string) => void;
  deleteAllTags: (boardId: string) => void;
  deleteConcept: (conceptId: string) => void;
  deleteAllConcepts: (boardId: string) => void;
  deletePreset: (presetId: string) => void;
  deleteRun: (runId: string) => void;
  deleteAllRuns: (boardId: string) => void;
  /** Append a completed demo session with its per-concept results. */
  recordRun: (run: Omit<DemoRun, "id" | "createdAt">) => DemoRun;
  resetDemo: () => void;
};

export function useDemoStore(): DemoStore {
  const [state, setState] = useState<DemoState>(() => loadDemoState());

  // Persist every change; the demo store is the source of truth for the page.
  useEffect(() => {
    saveDemoState(state);
  }, [state]);

  const createBoard = useCallback((input: { title: string; subject: string; color: string }): DemoBoard => {
    const board: DemoBoard = {
      id: nid("board"),
      title: input.title,
      subject: input.subject,
      color: input.color,
      masteryThreshold: 3,
    };
    setState((prev) => ({ ...prev, boards: [...prev.boards, board] }));
    return board;
  }, []);

  const updateBoard = useCallback((boardId: string, patch: Partial<Omit<DemoBoard, "id">>) => {
    setState((prev) => ({
      ...prev,
      boards: prev.boards.map((b) => (b.id === boardId ? { ...b, ...patch } : b)),
    }));
  }, []);

  const createTag = useCallback((boardId: string, name: string): DemoTag => {
    const tag: DemoTag = { id: nid("tag"), boardId, name };
    setState((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    return tag;
  }, []);

  const createConcept = useCallback(
    (boardId: string, input: { title: string; answer: string; hint: string | null; learned: boolean; tagIds: string[] }): DemoConcept => {
      const concept: DemoConcept = {
        id: nid("concept"),
        boardId,
        title: input.title,
        answer: input.answer,
        hint: input.hint,
        learned: input.learned,
        tagIds: input.tagIds,
        lastReviewed: null,
      };
      setState((prev) => ({ ...prev, concepts: [...prev.concepts, concept] }));
      return concept;
    },
    []
  );

  const updateConcept = useCallback(
    (boardId: string, conceptId: string, patch: { title?: string; answer?: string; hint?: string | null; learned?: boolean; tagIds?: string[] }) => {
      setState((prev) => ({
        ...prev,
        concepts: prev.concepts.map((c) =>
          c.id === conceptId && c.boardId === boardId ? { ...c, ...patch } : c
        ),
      }));
    },
    []
  );

  const renameTag = useCallback((tagId: string, name: string) => {
    setState((prev) => ({ ...prev, tags: prev.tags.map((t) => (t.id === tagId ? { ...t, name } : t)) }));
  }, []);

  const toggleLearned = useCallback((boardId: string, conceptId: string) => {
    setState((prev) => ({
      ...prev,
      concepts: prev.concepts.map((c) =>
        c.id === conceptId && c.boardId === boardId ? { ...c, learned: !c.learned } : c
      ),
    }));
  }, []);

  const createPreset = useCallback((boardId: string, input: Omit<DemoPreset, "id" | "boardId">): DemoPreset => {
    const preset: DemoPreset = { id: nid("preset"), boardId, ...input };
    setState((prev) => ({ ...prev, presets: [...prev.presets, preset] }));
    return preset;
  }, []);

  const updatePreset = useCallback((presetId: string, patch: Partial<Omit<DemoPreset, "id" | "boardId">>) => {
    setState((prev) => ({ ...prev, presets: prev.presets.map((p) => (p.id === presetId ? { ...p, ...patch } : p)) }));
  }, []);

  const deleteBoard = useCallback((boardId: string) => {
    setState((prev) => ({
      ...prev,
      boards: prev.boards.filter((b) => b.id !== boardId),
      tags: prev.tags.filter((t) => t.boardId !== boardId),
      concepts: prev.concepts.filter((c) => c.boardId !== boardId),
      presets: prev.presets.filter((p) => p.boardId !== boardId),
      runs: prev.runs.filter((r) => r.boardId !== boardId),
    }));
  }, []);

  const deleteTag = useCallback((tagId: string) => {
    setState((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t.id !== tagId),
      concepts: prev.concepts.map((c) => ({ ...c, tagIds: c.tagIds.filter((id) => id !== tagId) })),
      presets: prev.presets.map((p) => ({
        ...p,
        tagIds: p.tagIds ? p.tagIds.filter((id) => id !== tagId) : null,
      })),
    }));
  }, []);

  const deleteAllTags = useCallback((boardId: string) => {
    setState((prev) => {
      const boardTagIds = new Set(prev.tags.filter((t) => t.boardId === boardId).map((t) => t.id));
      return {
        ...prev,
        tags: prev.tags.filter((t) => t.boardId !== boardId),
        concepts: prev.concepts.map((c) =>
          c.boardId === boardId ? { ...c, tagIds: c.tagIds.filter((id) => !boardTagIds.has(id)) } : c
        ),
        presets: prev.presets.map((p) =>
          p.boardId === boardId && p.tagIds ? { ...p, tagIds: null } : p
        ),
      };
    });
  }, []);

  const deleteConcept = useCallback((conceptId: string) => {
    setState((prev) => ({ ...prev, concepts: prev.concepts.filter((c) => c.id !== conceptId) }));
  }, []);

  const deleteAllConcepts = useCallback((boardId: string) => {
    setState((prev) => ({
      ...prev,
      concepts: prev.concepts.filter((c) => c.boardId !== boardId),
      runs: prev.runs.filter((r) => r.boardId !== boardId),
    }));
  }, []);

  const deletePreset = useCallback((presetId: string) => {
    setState((prev) => ({ ...prev, presets: prev.presets.filter((p) => p.id !== presetId) }));
  }, []);

  const deleteRun = useCallback((runId: string) => {
    setState((prev) => ({ ...prev, runs: prev.runs.filter((r) => r.id !== runId) }));
  }, []);

  const deleteAllRuns = useCallback((boardId: string) => {
    setState((prev) => ({ ...prev, runs: prev.runs.filter((r) => r.boardId !== boardId) }));
  }, []);

  const recordRun = useCallback((run: Omit<DemoRun, "id" | "createdAt">): DemoRun => {
    const full: DemoRun = { ...run, id: nid("run"), createdAt: new Date().toISOString() };
    setState((prev) => ({ ...prev, runs: [...prev.runs, full] }));
    return full;
  }, []);

  const resetDemo = useCallback(() => {
    clearDemoState();
    setState(() => loadDemoState());
  }, []);

  return {
    state,
    setState,
    createBoard,
    updateBoard,
    createTag,
    createConcept,
    updateConcept,
    renameTag,
    toggleLearned,
    createPreset,
    updatePreset,
    deleteBoard,
    deleteTag,
    deleteAllTags,
    deleteConcept,
    deleteAllConcepts,
    deletePreset,
    deleteRun,
    deleteAllRuns,
    recordRun,
    resetDemo,
  };
}
