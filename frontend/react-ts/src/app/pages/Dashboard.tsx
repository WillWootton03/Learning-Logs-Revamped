import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Search, LayoutGrid, Flame, Plus } from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { useAuth } from "../context/AuthContext";
import { displayName } from "../lib/userName";
import { BoardCard } from "../components/BoardCard";
import { ActivityLog, type ActivityEntry } from "../components/ActivityLog";
import { listAllRuns, type ActivityRun } from "../lib/api/sessions";

type Filter = "all" | "in-progress" | "completed";

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [runs, setRuns] = useState<ActivityRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const navigate = useNavigate();
  const { boards, isBoardsLoading, boardsError, reloadBoards } = useBoard();
  const { user } = useAuth();

  // Past sessions across every board — the activity feed on the dashboard.
  useEffect(() => {
    let cancelled = false;
    setRunsLoading(true);
    listAllRuns()
      .then((rows) => {
        if (!cancelled) setRuns(rows);
      })
      .catch(() => {
        if (!cancelled) setRuns([]);
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = displayName(user?.fullName, user?.email);

  const activityEntries: ActivityEntry[] = runs.map((run) => ({
    id: run.id,
    boardId: run.boardId,
    type: "session",
    message: `${run.correctCount}/${run.conceptsStudied} correct · ${run.presetName}`,
    board: run.boardTitle,
    timestamp: run.date,
  }));

  if (isBoardsLoading) {
    return (
      <main className="max-w-7xl mx-auto px-8 py-24 flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-mono">Loading your boards…</p>
      </main>
    );
  }

  if (boardsError) {
    return (
      <main className="max-w-7xl mx-auto px-8 py-24 flex flex-col items-center gap-4">
        <LayoutGrid className="w-10 h-10 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">{boardsError}</p>
        <button
          onClick={reloadBoards}
          className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/40 transition-colors"
        >
          Try again
        </button>
      </main>
    );
  }

  const filtered = boards.filter((b) => {
    const matchSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.subject.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === "completed") return b.conceptCount > 0 && b.conceptsLearned === b.conceptCount;
    if (filter === "in-progress") return b.conceptCount === 0 || b.conceptsLearned < b.conceptCount;
    return true;
  });

  const totalConcepts = boards.reduce((s, b) => s + b.conceptCount, 0);
  const learnedConcepts = boards.reduce((s, b) => s + b.conceptsLearned, 0);
  const totalSessions = boards.reduce((s, b) => s + b.sessionCount, 0);
  const maxStreak = boards.length > 0 ? Math.max(...boards.map((b) => b.streakDays)) : 0;
  const completedBoards = boards.filter((b) => b.conceptCount > 0 && b.conceptsLearned === b.conceptCount).length;
  const pctComplete = totalConcepts === 0 ? 0 : Math.round((learnedConcepts / totalConcepts) * 100);

  // New accounts have no boards yet — greet with a call to action instead of
  // a wall of zeroed-out stats. Real data appears here once boards load.
  if (boards.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-8 py-24 flex flex-col items-center text-center gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <LayoutGrid className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-foreground text-2xl">
            {timeGreeting()}, {name}
          </h1>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            You don&apos;t have any boards yet. Create your first board to start capturing
            concepts, tracking streaks, and taking quizzes.
          </p>
          <button
            onClick={() => navigate("/app/board/new")}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
          >
            <Plus className="w-4 h-4" />
            Create your first board
          </button>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-8 py-10 flex flex-col gap-10">
      <div>
        <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">Dashboard</p>
        <h1 className="text-foreground">
          {timeGreeting()}, {name}
        </h1>
      </div>

      {/* summary stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <SummaryCard
          label="Concepts learned"
          value={`${learnedConcepts}/${totalConcepts}`}
          sub={`${pctComplete}% complete`}
          color="#7c6af7"
        />
        <SummaryCard label="Total sessions" value={String(totalSessions)} sub="across all boards" color="#4fb8f0" />
        <SummaryCard
          label="Best streak"
          value={`${maxStreak}d`}
          sub="keep it up"
          color="#f07c4f"
          icon={<Flame className="w-3 h-3" />}
        />
        <SummaryCard
          label="Boards mastered"
          value={`${completedBoards}/${boards.length}`}
          sub="fully completed"
          color="#4ff0b8"
        />
      </motion.div>

      {/* filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {(["all", "in-progress", "completed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs capitalize transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {/* Full width on mobile so the search aligns with the summary cards
            above it; fixed width again from sm up. */}
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search boards…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-full sm:w-52 transition-all"
            style={{ fontFamily: "var(--font-sans)" }}
          />
        </div>
      </div>

      {/* board grid + activity */}
      <div className="flex flex-col gap-8">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((board, i) => (
              <BoardCard
                key={board.id}
                board={board}
                index={i}
                onClick={() => navigate(`/app/board/${board.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <LayoutGrid className="w-8 h-8 opacity-30" />
            <span className="text-sm">No boards match your search</span>
          </div>
        )}
        {/* Past sessions across all boards, newest first. */}
        <ActivityLog
          entries={activityEntries}
          title="Activity Log"
          subtitle="Your sessions across all boards"
          badge={`${runs.length} session${runs.length === 1 ? "" : "s"}`}
          onSelect={(entry) => navigate(`/app/board/${entry.boardId}/sessions/${entry.id}`)}
          isLoading={runsLoading}
        />
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {icon && <span style={{ color }}>{icon}</span>}
        <span className="font-mono text-xl text-foreground">{value}</span>
      </div>
      <span className="text-[11px] text-muted-foreground font-mono">{sub}</span>
    </div>
  );
}
