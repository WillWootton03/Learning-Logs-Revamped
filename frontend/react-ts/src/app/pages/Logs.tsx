import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { FileText, Pencil, Plus } from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { useLogs } from "../context/LogContext";
import { LogModal } from "../components/LogModal";
import { BackButton } from "../components/BackButton";
import type { Log } from "../types";

/** Compact "Aug 4 · 7:05 PM" style timestamp from an ISO string. */
function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Logs() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { boards, isBoardsLoading } = useBoard();
  const { logs, loadLogs } = useLogs();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  // Bumped on every open so LogModal remounts fresh (its lazy state init
  // seeds from the log being edited).
  const [modalKey, setModalKey] = useState(0);

  const board = boards.find((b) => b.id === id);
  const boardLogs = id ? logs[id] ?? [] : [];
  const isLoading = loadedFor !== id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        await loadLogs(id);
        if (!cancelled) {
          setLoadedFor(id);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load logs");
          setLoadedFor(id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadLogs]);

  function openNew() {
    setEditingLog(null);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }

  function openEdit(log: Log) {
    setEditingLog(log);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }

  if (isBoardsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <p className="text-sm">Board not found.</p>
        <button onClick={() => navigate("/app")} className="text-primary text-sm hover:underline">
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-8 py-10 flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackButton to={`/app/board/${id}`} label={board.title} />
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
            <h1 className="text-foreground">Logs</h1>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New log
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
          <p className="text-sm">{loadError}</p>
          <button
            onClick={() => {
              setLoadError(null);
              setLoadedFor(null);
              loadLogs(id!);
            }}
            className="text-primary text-sm hover:underline"
          >
            Try again
          </button>
        </div>
      ) : boardLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
          <FileText className="w-7 h-7 opacity-30" />
          <p className="text-sm">No logs yet. Start writing.</p>
          <button onClick={openNew} className="text-primary text-sm hover:underline">
            Add your first log
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {boardLogs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.04 }}
              className="group bg-card border border-border rounded-xl px-5 py-4 flex flex-col gap-2 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-foreground leading-snug flex-1">{log.title}</h3>
                <button
                  onClick={() => openEdit(log)}
                  title="Edit log"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {log.body && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{log.body}</p>
              )}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] text-muted-foreground font-mono">{formatStamp(log.createdAt)}</span>
                {log.updatedAt !== log.createdAt && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    · edited {formatStamp(log.updatedAt)}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <LogModal
        key={modalKey}
        boardId={id!}
        log={editingLog}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </main>
  );
}
