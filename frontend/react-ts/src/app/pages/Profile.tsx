import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft, BarChart2, BookOpen, Clock, Flame, Target, TrendingUp, Trophy,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBoard } from "../context/BoardContext";
import { useSessions } from "../context/SessionContext";
import { displayName, initials } from "../lib/userName";

/** "March 2024" from an ISO timestamp; falls back to the raw string. */
function formatJoinDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function Profile() {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { boards, isBoardsLoading } = useBoard();
  const { sessions, loadSessions } = useSessions();
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Sessions live per board in SessionContext and are fetched on demand, so
  // pull every board's history once boards are known. The aggregate stats
  // below depend on them. The zero-delay timer defers the state writes out of
  // the effect body (the same pattern BoardContext uses to stay lint-clean).
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (isBoardsLoading) return;
      if (boards.length === 0) {
        setSessionsLoading(false);
        return;
      }
      setSessionsLoading(true);
      await Promise.all(boards.map((b) => loadSessions(b.id)));
      setSessionsLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [isBoardsLoading, boards, loadSessions]);

  const allSessions = Object.values(sessions).flat();

  const totalConcepts = boards.reduce((s, b) => s + b.conceptCount, 0);
  const learnedConcepts = boards.reduce((s, b) => s + b.conceptsLearned, 0);
  const totalSessions = allSessions.length;
  const totalConceptsStudied = allSessions.reduce((s, r) => s + r.conceptsStudied, 0);
  const totalCorrect = allSessions.reduce((s, r) => s + r.correctCount, 0);
  const overallAccuracy =
    totalConceptsStudied > 0 ? Math.round((totalCorrect / totalConceptsStudied) * 100) : 0;
  const masteredBoards = boards.filter(
    (b) => b.conceptsLearned === b.conceptCount && b.conceptCount > 0
  ).length;
  const maxStreak = Math.max(0, ...boards.map((b) => b.streakDays));
  const totalMinutes = allSessions.reduce((s, r) => s + Math.round(r.timeElapsedMs / 60_000), 0);
  const overallProgress = totalConcepts > 0 ? Math.round((learnedConcepts / totalConcepts) * 100) : 0;

  const boardStats = boards.map((board) => {
    const boardSessions = sessions[board.id] ?? [];
    const boardCorrect = boardSessions.reduce((s, r) => s + r.correctCount, 0);
    const boardStudied = boardSessions.reduce((s, r) => s + r.conceptsStudied, 0);
    const accuracy = boardStudied > 0 ? Math.round((boardCorrect / boardStudied) * 100) : null;
    const progress =
      board.conceptCount > 0 ? Math.round((board.conceptsLearned / board.conceptCount) * 100) : 0;
    return { board, boardSessions, accuracy, progress };
  });

  if (isAuthLoading || isBoardsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  const name = displayName(user?.fullName, user?.email);
  const handle = user?.email ? `@${user.email.split("@")[0]}` : "";
  const joinedDate = formatJoinDate(user?.createdAt);

  return (
    <main className="max-w-4xl mx-auto px-8 py-10 flex flex-col gap-10">
      <div>
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </button>
      </div>

      {/* profile header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        {/* banner */}
        <div className="h-24 bg-linear-to-r from-primary/30 via-[#4fb8f0]/20 to-[#4ff0b8]/20 relative">
          <div className="absolute bottom-0 left-6 translate-y-1/2">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 border-4 border-card flex items-center justify-center">
              <span className="text-xl text-primary font-mono">{initials(user?.fullName, user?.email)}</span>
            </div>
          </div>
        </div>

        <div className="px-6 pt-12 pb-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-foreground">{name}</h1>
              {handle && <p className="text-sm text-muted-foreground font-mono">{handle}</p>}
            </div>
            <button
              onClick={() => navigate("/app/settings")}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              Edit profile
            </button>
          </div>

          <div className="flex items-center gap-4 flex-wrap text-[11px] text-muted-foreground font-mono">
            {user?.email && <span>{user.email}</span>}
            {user?.email && joinedDate && <span>·</span>}
            {joinedDate && <span>Joined {joinedDate}</span>}
          </div>

          {/* quick stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border mt-1">
            {[
              { label: "Boards", value: boards.length },
              { label: "Mastered", value: masteredBoards },
              { label: "Sessions", value: totalSessions },
              { label: "Best streak", value: `${maxStreak}d` },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5 text-center">
                <span className="font-mono text-lg text-foreground">{s.value}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* overall learning stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-foreground">Learning overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Target className="w-4 h-4" />}
            label="Concepts learned"
            value={`${learnedConcepts}/${totalConcepts}`}
            color="#7c6af7"
          />
          <StatCard
            icon={<BarChart2 className="w-4 h-4" />}
            label="Overall accuracy"
            value={`${overallAccuracy}%`}
            color={overallAccuracy >= 80 ? "#4ff0b8" : overallAccuracy >= 50 ? "#f0c94f" : "#f07c4f"}
          />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Study time" value={`${totalMinutes}m`} color="#4fb8f0" />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Concepts studied" value={String(totalConceptsStudied)} color="#f04fb0" />
        </div>

        {/* overall progress bar */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Overall progress across all boards</span>
            <span className="font-mono text-sm text-primary">{overallProgress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              className="h-full rounded-full bg-primary"
            />
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            {learnedConcepts} of {totalConcepts} total concepts learned
          </p>
        </div>
      </motion.div>

      {/* per-board breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.14 }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-foreground">Board breakdown</h2>
        {sessionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : boardStats.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">No boards yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {boardStats.map(({ board, boardSessions, accuracy, progress }, i) => {
              const allLearned = board.conceptsLearned === board.conceptCount && board.conceptCount > 0;
              return (
                <motion.div
                  key={board.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.14 + i * 0.05 }}
                  onClick={() => navigate(`/app/board/${board.id}`)}
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer group relative overflow-hidden"
                >
                  {/* color top line */}
                  <div className="absolute top-0 left-5 right-5 h-0.5 rounded-full" style={{ background: board.color }} />

                  <div className="flex flex-col gap-4 pt-1">
                    {/* header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{board.subject}</p>
                        <h3 className="text-foreground mt-0.5">{board.title}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {allLearned ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono bg-emerald-400/10 px-2.5 py-1 rounded-full">
                            <Trophy className="w-3 h-3" />
                            Mastered
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded-full">In progress</span>
                        )}
                      </div>
                    </div>

                    {/* progress bar */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-muted-foreground">
                          {board.conceptsLearned}/{board.conceptCount} concepts
                        </span>
                        <span style={{ color: board.color }}>{progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: board.color }} />
                      </div>
                    </div>

                    {/* mini stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat icon={<BookOpen className="w-3 h-3" />} label="Sessions" value={boardSessions.length} />
                      <MiniStat icon={<BarChart2 className="w-3 h-3" />} label="Accuracy" value={accuracy !== null ? `${accuracy}%` : "—"} />
                      <MiniStat icon={<Flame className="w-3 h-3" />} label="Streak" value={`${board.streakDays}d`} highlight={board.streakDays >= 7} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </main>
  );
}

function StatCard({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
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

function MiniStat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 bg-secondary rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span className={`font-mono text-sm ${highlight ? "text-amber-400" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
