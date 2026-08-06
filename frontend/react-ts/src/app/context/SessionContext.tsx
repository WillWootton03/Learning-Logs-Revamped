import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
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

  const loadSessions = useCallback(async (boardId: string) => {
    const runs = await listRuns(boardId);
    setSessions((prev) => ({ ...prev, [boardId]: runs }));
  }, []);

  const loadSessionPresets = useCallback(async (boardId: string) => {
    // matchAllTags and exactMatching are both persisted server-side now, so a
    // refetch returns the authoritative modes and needs no local carry-over.
    const presets = await listQuizSettings(boardId);
    setSessionPresets((prev) => ({ ...prev, [boardId]: presets }));
    return presets;
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
        matchAllTags: input.matchAllTags,
        tagIds: input.tagIds ?? [],
      });
      // Both modes come back from the server (they're persisted), so the
      // created preset needs no local carry-over.
      setSessionPresets((prev) => ({ ...prev, [boardId]: [...(prev[boardId] ?? []), preset] }));
      return preset;
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
        matchAllTags: preset.matchAllTags,
      });
      // Tag filtering is managed through the separate add/remove endpoints, so
      // diff the saved filter against the edited one.
      const prevIds = prev?.tagIds ?? [];
      const nextIds = preset.tagIds ?? [];
      const toAdd = nextIds.filter((id) => !prevIds.includes(id));
      const toRemove = prevIds.filter((id) => !nextIds.includes(id));
      if (toAdd.length > 0) await addQuizSettingsTags(boardId, preset.id, toAdd);
      if (toRemove.length > 0) await removeQuizSettingsTags(boardId, preset.id, toRemove);
      // Refetch so local state reflects the server's canonical tag_ids, mode
      // flags included (both are persisted now).
      await loadSessionPresets(boardId);
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
