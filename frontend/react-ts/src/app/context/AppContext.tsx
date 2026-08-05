import { createContext, useContext, useState, type ReactNode } from "react";
import type { Board, Concept, Log, SessionPreset, SessionRecord } from "../types";

type AppState = {
  boards: Board[];
  concepts: Record<string, Concept[]>;
  sessionPresets: SessionPreset[];
  sessions: SessionRecord[];
  logs: Log[];
  addBoard: (board: Board) => void;
  addConcept: (boardId: string, concept: Concept) => void;
  updateConceptTags: (boardId: string, conceptId: string, tags: string[]) => void;
  toggleConceptLearned: (boardId: string, conceptId: string) => void;
  addSessionPreset: (preset: SessionPreset) => void;
  updateSessionPreset: (preset: SessionPreset) => void;
  deleteSessionPreset: (id: string) => void;
  addLog: (log: Log) => void;
  updateLog: (log: Log) => void;
  deleteLog: (id: string) => void;
  deleteConcept: (boardId: string, conceptId: string) => void;
  removeTagFromBoard: (boardId: string, tag: string) => void;
  boardTagPool: Record<string, string[]>;
  addTagToPool: (boardId: string, tag: string) => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // All state starts empty — real data is loaded from the backend API. No
  // demo/seed data is shipped in the app.
  const [boards, setBoards] = useState<Board[]>([]);
  const [concepts, setConcepts] = useState<Record<string, Concept[]>>({});
  const [sessionPresets, setSessionPresets] = useState<SessionPreset[]>([]);
  const [sessions] = useState<SessionRecord[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [boardTagPool, setBoardTagPool] = useState<Record<string, string[]>>({});

  function addBoard(board: Board) {
    setBoards((prev) => [...prev, board]);
    setConcepts((prev) => ({ ...prev, [board.id]: [] }));
  }

  function addConcept(boardId: string, concept: Concept) {
    setConcepts((prev) => ({ ...prev, [boardId]: [...(prev[boardId] ?? []), concept] }));
    setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, conceptCount: b.conceptCount + 1 } : b));
  }

  function updateConceptTags(boardId: string, conceptId: string, tags: string[]) {
    setConcepts((prev) => ({
      ...prev,
      [boardId]: prev[boardId].map((c) => (c.id === conceptId ? { ...c, tags } : c)),
    }));
  }

  function toggleConceptLearned(boardId: string, conceptId: string) {
    setConcepts((prev) => {
      const updated = prev[boardId].map((c) => c.id === conceptId ? { ...c, learned: !c.learned } : c);
      const learnedCount = updated.filter((c) => c.learned).length;
      setBoards((b) => b.map((board) => board.id === boardId ? { ...board, conceptsLearned: learnedCount } : board));
      return { ...prev, [boardId]: updated };
    });
  }

  function addSessionPreset(preset: SessionPreset) {
    setSessionPresets((prev) => [...prev, preset]);
  }

  function updateSessionPreset(preset: SessionPreset) {
    setSessionPresets((prev) => prev.map((p) => (p.id === preset.id ? preset : p)));
  }

  function deleteSessionPreset(id: string) {
    setSessionPresets((prev) => prev.filter((p) => p.id !== id));
  }

  function deleteConcept(boardId: string, conceptId: string) {
    setConcepts((prev) => {
      const updated = prev[boardId].filter((c) => c.id !== conceptId);
      const learnedCount = updated.filter((c) => c.learned).length;
      setBoards((b) => b.map((board) =>
        board.id === boardId
          ? { ...board, conceptCount: updated.length, conceptsLearned: learnedCount }
          : board
      ));
      return { ...prev, [boardId]: updated };
    });
  }

  function addTagToPool(boardId: string, tag: string) {
    setBoardTagPool((prev) => {
      const existing = prev[boardId] ?? [];
      if (existing.includes(tag)) return prev;
      return { ...prev, [boardId]: [...existing, tag] };
    });
  }

  function removeTagFromBoard(boardId: string, tag: string) {
    setBoardTagPool((prev) => ({
      ...prev,
      [boardId]: (prev[boardId] ?? []).filter((t) => t !== tag),
    }));
    setConcepts((prev) => ({
      ...prev,
      [boardId]: prev[boardId].map((c) => ({
        ...c,
        tags: c.tags.filter((t) => t !== tag),
      })),
    }));
  }

  function addLog(log: Log) {
    setLogs((prev) => [log, ...prev]);
  }

  function updateLog(log: Log) {
    setLogs((prev) => prev.map((l) => (l.id === log.id ? log : l)));
  }

  function deleteLog(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <AppContext.Provider value={{
      boards, concepts, sessionPresets, sessions, logs,
      addBoard, addConcept, updateConceptTags, toggleConceptLearned,
      addSessionPreset, updateSessionPreset, deleteSessionPreset,
      addLog, updateLog, deleteLog,
      deleteConcept, removeTagFromBoard,
      boardTagPool, addTagToPool,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
