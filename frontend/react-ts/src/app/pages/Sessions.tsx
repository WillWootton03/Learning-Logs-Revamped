import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import { BarChart2, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock, Flame, Plus, Trash2 } from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { useSessions } from "../context/SessionContext";
import { SessionModal } from "../components/SessionModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { BackButton } from "../components/BackButton";

export function Sessions() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { boards, isBoardsLoading } = useBoard();
  const { sessions, loadSessions, deleteAllSessions } = useSessions();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const board = boards.find((b) => b.id === id);
  const boardSessions = id ? sessions[id] ?? [] : [];
  const isLoading = loadedFor !== id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        await loadSessions(id);
        if (!cancelled) {
          setLoadedFor(id);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load sessions");
          setLoadedFor(id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadSessions]);

  const totalConcepts = boardSessions.reduce((sum, s) => sum + s.conceptsStudied, 0);
  const avgPerSession = boardSessions.length ? Math.round(totalConcepts / boardSessions.length) : 0;
  const totalMinutes = boardSessions.reduce((sum, s) => sum + Math.round(s.timeElapsedMs / 60_000), 0);

  async function handleDeleteAll() {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteAllSessions(id);
      setDeleteOpen(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to delete sessions");
      setDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
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
    <main className="max-w-7xl mx-auto px-8 py-10 flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <BackButton to={`/app/board/${id}`} label={board.title} />
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
            <h1 className="text-foreground">Sessions</h1>
          </div>
          <div className="flex items-center gap-2">
            {boardSessions.length > 0 && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-500/25 text-sm text-rose-400 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete all
              </button>
            )}
            <button
              onClick={() => setSessionOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Start new session
            </button>
          </div>
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
              loadSessions(id!);
            }}
            className="text-primary text-sm hover:underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* summary */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <SummaryCard icon={<BookOpen className="w-4 h-4" />} label="Total sessions" value={String(boardSessions.length)} color="#7c6af7" />
            <SummaryCard icon={<BarChart2 className="w-4 h-4" />} label="Concepts studied" value={String(totalConcepts)} color="#4fb8f0" />
            <SummaryCard icon={<Clock className="w-4 h-4" />} label="Total time" value={`${totalMinutes} min`} color="#f07c4f" />
            <SummaryCard icon={<Flame className="w-4 h-4" />} label="Avg per session" value={String(avgPerSession)} color="#4ff0b8" />
          </motion.div>

          {/* list */}
          <div className="flex flex-col gap-2">
            {boardSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
                <BookOpen className="w-7 h-7 opacity-30" />
                <p className="text-sm">No sessions recorded for this board yet.</p>
              </div>
            ) : (
              boardSessions.map((session, i) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.04 }}
                  onClick={() => navigate(`/app/board/${id}/sessions/${session.id}`)}
                  className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/30 transition-colors cursor-pointer group"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: board.color ?? "#7c6af7" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{session.presetName}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {session.conceptsStudied} concepts
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">{session.correctCount}</span>/{session.conceptsStudied} correct
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.duration}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-muted-foreground font-mono hidden sm:flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {session.date}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </>
      )}

      <SessionModal
        boardId={id!}
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onStart={(presetId) => navigate(`/app/board/${id}/sessions/play?presetId=${presetId}`)}
      />
      <ConfirmModal
        open={deleteOpen}
        title="Delete all sessions"
        description={`This permanently deletes all ${boardSessions.length} session records on this board. This cannot be undone.`}
        busy={isDeleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAll}
      />
    </main>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <span className="font-mono text-xl text-foreground">{value}</span>
    </div>
  );
}
