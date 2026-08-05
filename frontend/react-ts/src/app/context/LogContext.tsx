import { createContext, useContext, useState, type ReactNode } from "react";
import type { Log } from "../types";

type LogState = {
  logs: Log[];
  addLog: (log: Log) => void;
  updateLog: (log: Log) => void;
  deleteLog: (id: string) => void;
};

const LogContext = createContext<LogState | null>(null);

export function LogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<Log[]>([]);

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
    <LogContext.Provider value={{ logs, addLog, updateLog, deleteLog }}>{children}</LogContext.Provider>
  );
}

export function useLogs() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error("useLogs must be used inside LogProvider");
  return ctx;
}
