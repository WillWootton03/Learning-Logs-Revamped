import { createContext, useContext, useState, type ReactNode } from "react";
import type { SessionPreset, SessionRecord } from "../types";

type SessionState = {
  sessionPresets: SessionPreset[];
  sessions: SessionRecord[];
  addSessionPreset: (preset: SessionPreset) => void;
  updateSessionPreset: (preset: SessionPreset) => void;
  deleteSessionPreset: (id: string) => void;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionPresets, setSessionPresets] = useState<SessionPreset[]>([]);
  // Backed by the quiz-runs model; still empty until the sessions UI is wired
  // to the quiz endpoints. Kept as state so future recording writes here.
  const [sessions] = useState<SessionRecord[]>([]);

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
      value={{ sessionPresets, sessions, addSessionPreset, updateSessionPreset, deleteSessionPreset }}
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
