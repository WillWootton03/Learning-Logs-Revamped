import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Circle,
  BookOpen,
  Flame,
  CalendarDays,
  RotateCcw,
  Trophy,
  Plus,
  Upload,
} from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { useConcepts } from "../context/ConceptContext";
import { AddConceptModal } from "../components/AddConceptModal";
import { ComingSoonModal } from "../components/ComingSoonModal";
import { SessionModal } from "../components/SessionModal";
import { BackButton } from "../components/BackButton";

export function BoardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { boards, isBoardsLoading } = useBoard();
  const { concepts, loadConcepts } = useConcepts();
  const [addConceptOpen, setAddConceptOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Tracks the board whose concepts have finished loading; while it doesn't
  // match the current route the page shows a spinner. Using derived state
  // (rather than resetting flags in the effect) keeps all writes in callbacks.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const board = boards.find((b) => b.id === id);
  const boardConcepts = id ? concepts[id] ?? [] : [];
  const isLoading = loadedFor !== id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadConcepts(id)
      .then(() => {
        if (!cancelled) {
          setLoadedFor(id);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load concepts");
          setLoadedFor(id);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadConcepts]);

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

  const learnedCount = boardConcepts.filter((c) => c.learned).length;
  const totalCount = boardConcepts.length;
  const progress = totalCount > 0 ? Math.round((learnedCount / totalCount) * 100) : 0;
  const allLearned = totalCount > 0 && learnedCount === totalCount;

  return (
    <>
      <main className="max-w-7xl mx-auto px-8 py-10 flex flex-col gap-8">
        {/* back + header */}
        <div className="flex flex-col gap-4">
          <BackButton to="/app" label="Dashboard" />

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
              <h1 className="text-foreground">{board.title}</h1>
            </div>
            <button
              onClick={() => setSessionOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Start session
            </button>
          </div>
        </div>

        {/* stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          <StatCard icon={<BookOpen className="w-4 h-4" />} label="Sessions" value={board.sessionCount} color={board.color} />
          <StatCard icon={<Flame className="w-4 h-4" />} label="Streak" value={`${board.streakDays}d`} color="#f07c4f" />
          <StatCard icon={<CalendarDays className="w-4 h-4" />} label="Last used" value={board.lastUsed} color="#4fb8f0" />
          <StatCard
            icon={<Trophy className="w-4 h-4" />}
            label="Status"
            value={allLearned ? "Mastered" : "In progress"}
            color={allLearned ? "#4ff0b8" : "#7c6af7"}
          />
        </motion.div>

        {/* progress */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Overall progress</span>
            <span className="font-mono text-sm" style={{ color: board.color }}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
              className="h-full rounded-full"
              style={{ background: board.color }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            {learnedCount} of {totalCount} concepts learned
          </p>
        </div>

        {/* concepts list */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground">Concepts</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCsvOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload CSV
              </button>
              <button
                onClick={() => setAddConceptOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add concept
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
                  loadConcepts(id!);
                }}
                className="text-primary text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          ) : boardConcepts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
              <BookOpen className="w-7 h-7 opacity-30" />
              <p className="text-sm">No concepts yet. Add your first one.</p>
            </div>
          ) : (
            boardConcepts.map((concept, i) => (
              <motion.div
                key={concept.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                onClick={() => navigate(`/app/board/${id}/concept/${concept.id}`)}
                className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <div className="shrink-0">
                  {concept.learned ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${concept.learned ? "text-foreground" : "text-muted-foreground"}`}>
                    {concept.title}
                  </p>
                  {concept.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {concept.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {concept.lastReviewed && (
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden sm:block">
                    {concept.lastReviewed}
                  </span>
                )}
              </motion.div>
            ))
          )}
        </div>
      </main>

      <AddConceptModal boardId={id!} open={addConceptOpen} onClose={() => setAddConceptOpen(false)} />
      <SessionModal
        boardId={id!}
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onStart={(presetId) => navigate(`/app/board/${id}/sessions/play?presetId=${presetId}`)}
      />
      <ComingSoonModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        title="Upload CSV"
        description="Bulk-importing concepts from a CSV needs a new import endpoint. Coming soon."
      />
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <span className="font-mono text-lg text-foreground">{value}</span>
    </div>
  );
}
