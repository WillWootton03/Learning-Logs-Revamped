import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { SessionPreset, SessionRecord } from "../types";
import { listRuns } from "../lib/api";

type SessionState = {
  /** Quiz runs per board, keyed by board id. */
  sessions: Record<string, SessionRecord[]>;
  loadSessions: (boardId: string) => Promise<void>;
  sessionPresets: SessionPreset[];
  addSessionPreset: (preset: SessionPreset) => void;
  updateSessionPreset: (preset: SessionPreset) => void;
  deleteSessionPreset: (id: string) => void;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, SessionRecord[]>>({});
  // Preset CRUD is still local-only until the "start a session" flow is wired
  // to the quiz-settings endpoints (which require a quiz style).
  const [sessionPresets, setSessionPresets] = useState<SessionPreset[]>([]);

  const loadSessions = useCallback(async (boardId: string) => {
    const runs = await listRuns(boardId);
    setSessions((prev) => ({ ...prev, [boardId]: runs }));
  }, []);

  function addSessionPreset(preset: SessionPreset) {
    setSessionPresets((prev) => [...prev, preset]);
  }

  function updateSessionPreset(preset: SessionPreset) {
    setSessionPresets((prev) => prev.map((p) => (p.id === preset.id ? preset : p)));
  }

  function deleteSessionPreset(id: string) {
    setSessionPresets((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <SessionContext.Provider
      value={{ sessions, loadSessions, sessionPresets, addSessionPreset, updateSessionPreset, deleteSessionPreset }}
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
