import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Clock, Eye, ListFilter, Tag, Type, XCircle } from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { BackButton } from "../components/BackButton";
import { getRunBreakdown } from "../lib/api";
import type { SessionDetail } from "../lib/api";

export function SessionDetail() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const { boards, isBoardsLoading } = useBoard();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const board = boards.find((b) => b.id === id);

  useEffect(() => {
    if (!id || !sessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const detail = await getRunBreakdown(id, sessionId);
        if (!cancelled) {
          setSession(detail);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load session");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, sessionId]);

  if (isBoardsLoading || loading) {
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

  if (!session || loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <p className="text-sm">{loadError ?? "Session not found."}</p>
        <button
          onClick={() => navigate(`/app/board/${id}/sessions`)}
          className="flex items-center gap-1.5 text-primary text-sm hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sessions
        </button>
      </div>
    );
  }

  const accuracy =
    session.conceptsStudied > 0
      ? Math.round((session.correctCount / session.conceptsStudied) * 100)
      : 0;
  const accuracyColor = accuracy >= 80 ? "#4ff0b8" : accuracy >= 50 ? "#f0c94f" : "#f07c4f";
  const incorrectCount = session.conceptsStudied - session.correctCount;

  return (
    <main className="max-w-3xl mx-auto px-8 py-10 flex flex-col gap-8">
      {/* breadcrumb + back */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <button
            onClick={() => navigate(`/app/board/${id}`)}
            className="hover:text-foreground transition-colors"
          >
            {board.title}
          </button>
          <span>/</span>
          <button
            onClick={() => navigate(`/app/board/${id}/sessions`)}
            className="hover:text-foreground transition-colors"
          >
            Sessions
          </button>
          <span>/</span>
          <span className="text-foreground">{session.date}</span>
        </div>
        <BackButton to={`/app/board/${id}/sessions`} label="Sessions" />
      </div>

      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-2"
      >
        <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono">{board.subject}</p>
        <h1 className="text-foreground">{session.presetName}</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-mono">
          <CalendarDays className="w-3.5 h-3.5" />
          {session.date}
        </p>
      </motion.div>

      {/* stat cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <StatCard
          label="Concepts"
          value={String(session.conceptsStudied)}
          icon={<BookOpen className="w-4 h-4" />}
          color={board.color ?? "#7c6af7"}
        />
        <StatCard
          label="Correct"
          value={String(session.correctCount)}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="#4ff0b8"
        />
        <StatCard label="Accuracy" value={`${accuracy}%`} icon={<CheckCircle2 className="w-4 h-4" />} color={accuracyColor} />
        <StatCard label="Duration" value={session.duration} icon={<Clock className="w-4 h-4" />} color="#4fb8f0" />
      </motion.div>

      {/* session settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
      >
        <h2 className="text-foreground">Session settings</h2>
        <div className="flex flex-col gap-2">
          <SettingRow
            icon={<Eye className="w-3.5 h-3.5" />}
            label="Learned concepts"
            value={session.includeKnown ? "Included" : "Excluded"}
            active={session.includeKnown}
          />
          <SettingRow
            icon={<Tag className="w-3.5 h-3.5" />}
            label="Tag filter"
            value={
              session.allowedTags === null
                ? "All tags"
                : session.allowedTags.length === 0
                  ? "No tags selected"
                  : session.matchAllTags
                    ? `${session.allowedTags.join(", ")} (all)`
                    : session.allowedTags.join(", ")
            }
            active={session.allowedTags === null}
          />
          <SettingRow
            icon={<Type className="w-3.5 h-3.5" />}
            label="Exact answer matching"
            value={session.exactMatching ? "Exact" : "Lenient"}
            active={session.exactMatching}
          />
          <SettingRow
            icon={<ListFilter className="w-3.5 h-3.5" />}
            label="Match all selected tags"
            value={session.allowedTags === null ? "Not applicable" : session.matchAllTags ? "On" : "Off"}
            active={session.allowedTags !== null && session.matchAllTags}
          />
        </div>
      </motion.div>

      {/* accuracy bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Accuracy</span>
          <span className="font-mono text-sm" style={{ color: accuracyColor }}>
            {accuracy}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${accuracy}%` }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
            className="h-full rounded-full"
            style={{ background: accuracyColor }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground font-mono">
          {session.correctCount} correct · {incorrectCount} incorrect
        </p>
      </motion.div>

      {/* concept results */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-foreground">Concepts reviewed</h2>
        {session.results.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">No questions were recorded for this session.</p>
        ) : (
          session.results.map((row, i) => (
            <motion.div
              key={row.conceptId}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.15 + i * 0.04 }}
              onClick={() => navigate(`/app/board/${id}/concept/${row.conceptId}`)}
              className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/30 transition-colors cursor-pointer group"
            >
              {row.correct ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{row.title}</p>
                {row.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {row.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span
                className={`text-xs font-mono shrink-0 px-2.5 py-1 rounded-full ${
                  row.correct ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"
                }`}
              >
                {row.correct ? "Correct" : "Incorrect"}
              </span>
            </motion.div>
          ))
        )}
      </motion.div>
    </main>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: ReactNode; color: string }) {
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

function SettingRow({
  icon,
  label,
  value,
  active,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-secondary">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-xs font-mono ${active ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}
