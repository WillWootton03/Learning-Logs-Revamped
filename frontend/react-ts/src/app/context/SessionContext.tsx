import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionPreset, SessionRecord } from "../types";
import {
  addQuizSettingsTags,
  createQuizSettings,
  deleteAllRuns,
  deleteQuizSettings,
  listQuizSettings,
  listRuns,
  removeQuizSettingsTags,
  updateQuizSettings,
} from "../lib/api";

type SessionState = {
  /** Quiz runs per board, keyed by board id. */
  sessions: Record<string, SessionRecord[]>;
  loadSessions: (boardId: string) => Promise<void>;
  /** Saved quiz settings (session presets) per board, keyed by board id. */
  sessionPresets: Record<string, SessionPreset[]>;
  /** Load a board's saved settings. Resolves with the loaded presets. */
  loadSessionPresets: (boardId: string) => Promise<SessionPreset[]>;
  /** Create a saved setting with an explicit question type. */
  createSessionPreset: (
    boardId: string,
    input: {
      name: string;
      style: SessionPreset["style"];
      includeKnown: boolean;
      tagIds: string[] | null;
      matchAllTags: boolean;
      exactMatching: boolean;
    }
  ) => Promise<SessionPreset>;
  /** Persist a preset's fields and sync its tag filter. */
  updateSessionPreset: (boardId: string, preset: SessionPreset) => Promise<void>;
  deleteSessionPreset: (boardId: string, id: string) => Promise<void>;
  /** Delete every quiz run (session history) on a board, then clear locally. */
  deleteAllSessions: (boardId: string) => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, SessionRecord[]>>({});
  const [sessionPresets, setSessionPresets] = useState<Record<string, SessionPreset[]>>({});
  // Mirror of sessionPresets for stable callbacks: loadSessionPresets reads
  // the freshest presets here instead of depending on state, so its identity
  // never changes (which would otherwise loop the effects that depend on it).
  const sessionPresetsRef = useRef(sessionPresets);
  useEffect(() => {
    sessionPresetsRef.current = sessionPresets;
  }, [sessionPresets]);

  const loadSessions = useCallback(async (boardId: string) => {
    const runs = await listRuns(boardId);
    setSessions((prev) => ({ ...prev, [boardId]: runs }));
  }, []);

  const loadSessionPresets = useCallback(async (boardId: string) => {
    const presets = await listQuizSettings(boardId);
    // matchAllTags is frontend-only, so a refetch must not clobber the mode
    // the user picked for presets that are already in local state.
    const existing = new Map((sessionPresetsRef.current[boardId] ?? []).map((p) => [p.id, p]));
    const merged = presets.map((p) => {
      const ex = existing.get(p.id);
      return ex ? { ...p, matchAllTags: ex.matchAllTags } : p;
    });
    setSessionPresets((prev) => ({ ...prev, [boardId]: merged }));
    return merged;
  }, []);

  const createSessionPreset = useCallback(
    async (
      boardId: string,
      input: {
        name: string;
        style: SessionPreset["style"];
        includeKnown: boolean;
        tagIds: string[] | null;
        matchAllTags: boolean;
        exactMatching: boolean;
      }
    ) => {
      const preset = await createQuizSettings(boardId, {
        name: input.name,
        style: input.style,
        includeKnown: input.includeKnown,
        exactMatching: input.exactMatching,
        tagIds: input.tagIds ?? [],
      });
      // The backend doesn't persist match-all mode, so carry that picked mode
      // over onto the created preset's local state (exact matching IS
      // persisted, so it comes back from the server already).
      const withMode = { ...preset, matchAllTags: input.matchAllTags };
      setSessionPresets((prev) => ({ ...prev, [boardId]: [...(prev[boardId] ?? []), withMode] }));
      return withMode;
    },
    []
  );

  const updateSessionPreset = useCallback(
    async (boardId: string, preset: SessionPreset) => {
      const prev = (sessionPresets[boardId] ?? []).find((p) => p.id === preset.id);
      await updateQuizSettings(boardId, preset.id, {
        name: preset.name,
        style: preset.style,
        includeKnown: preset.includeKnown,
        exactMatching: preset.exactMatching,
      });
      // Tag filtering is managed through the separate add/remove endpoints, so
      // diff the saved filter against the edited one.
      const prevIds = prev?.tagIds ?? [];
      const nextIds = preset.tagIds ?? [];
      const toAdd = nextIds.filter((id) => !prevIds.includes(id));
      const toRemove = prevIds.filter((id) => !nextIds.includes(id));
      if (toAdd.length > 0) await addQuizSettingsTags(boardId, preset.id, toAdd);
      if (toRemove.length > 0) await removeQuizSettingsTags(boardId, preset.id, toRemove);
      // Refetch so local state reflects the server's canonical tag_ids, then
      // restore the match-all mode (the only frontend-only field — exact
      // matching is persisted and comes back from the server).
      await loadSessionPresets(boardId);
      setSessionPresets((prev) => ({
        ...prev,
        [boardId]: (prev[boardId] ?? []).map((p) =>
          p.id === preset.id ? { ...p, matchAllTags: preset.matchAllTags } : p
        ),
      }));
    },
    [sessionPresets, loadSessionPresets]
  );

  const deleteSessionPreset = useCallback(async (boardId: string, id: string) => {
    await deleteQuizSettings(boardId, id);
    setSessionPresets((prev) => ({
      ...prev,
      [boardId]: (prev[boardId] ?? []).filter((p) => p.id !== id),
    }));
  }, []);

  /** Delete every quiz run on the board, then clear the local list. */
  const deleteAllSessions = useCallback(async (boardId: string) => {
    await deleteAllRuns(boardId);
    setSessions((prev) => ({ ...prev, [boardId]: [] }));
  }, []);

  return (
    <SessionContext.Provider
      value={{
        sessions,
        loadSessions,
        sessionPresets,
        loadSessionPresets,
        createSessionPreset,
        updateSessionPreset,
        deleteSessionPreset,
        deleteAllSessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessions() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessions must be used inside SessionProvider");
  return ctx;
}
