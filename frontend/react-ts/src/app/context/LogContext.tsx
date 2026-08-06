import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Log } from "../types";
import {
  createLog as apiCreateLog,
  deleteLog as apiDeleteLog,
  listLogs,
  updateLog as apiUpdateLog,
} from "../lib/api";

type LogState = {
  /** Logs per board, keyed by board id. */
  logs: Record<string, Log[]>;
  loadLogs: (boardId: string) => Promise<void>;
  createLog: (boardId: string, input: { title: string; body: string }) => Promise<Log>;
  updateLog: (boardId: string, logId: string, changes: { title?: string; body?: string }) => Promise<void>;
  deleteLog: (boardId: string, logId: string) => Promise<void>;
};

const LogContext = createContext<LogState | null>(null);

export function LogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<Record<string, Log[]>>({});

  const loadLogs = useCallback(async (boardId: string) => {
    const rows = await listLogs(boardId);
    setLogs((prev) => ({ ...prev, [boardId]: rows }));
  }, []);

  const createLog = useCallback(async (boardId: string, input: { title: string; body: string }) => {
    const log = await apiCreateLog(boardId, input);
    setLogs((prev) => ({ ...prev, [boardId]: [log, ...(prev[boardId] ?? [])] }));
    return log;
  }, []);

  const updateLog = useCallback(
    async (boardId: string, logId: string, changes: { title?: string; body?: string }) => {
      const row = await apiUpdateLog(boardId, logId, changes);
      setLogs((prev) => ({
        ...prev,
        [boardId]: (prev[boardId] ?? []).map((l) =>
          l.id === logId
            ? // Keep the original createdAt so the "edited" marker stays
              // meaningful after a save in the same session.
              { ...row, createdAt: l.createdAt }
            : l
        ),
      }));
    },
    []
  );

  const deleteLog = useCallback(async (boardId: string, logId: string) => {
    await apiDeleteLog(boardId, logId);
    setLogs((prev) => ({
      ...prev,
      [boardId]: (prev[boardId] ?? []).filter((l) => l.id !== logId),
    }));
  }, []);

  return (
    <LogContext.Provider value={{ logs, loadLogs, createLog, updateLog, deleteLog }}>
      {children}
    </LogContext.Provider>
  );
}

export function useLogs() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error("useLogs must be used inside LogProvider");
  return ctx;
}
