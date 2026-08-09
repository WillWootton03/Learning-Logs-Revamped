import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, ArrowRight, BarChart2, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, Circle,
  Clock, Flame, GraduationCap, LayoutGrid, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, Tag, Trophy, Upload, X,
} from "lucide-react";
import { useDemoStore } from "../demo/useDemoStore";
import {
  DemoAddConceptModal,
  DemoAddTagModal,
  DemoNewBoardModal,
  DemoNewSettingModal,
  DemoStartSessionModal,
} from "../demo/DemoModals";
import { DemoQuiz } from "../demo/DemoQuiz";
import {
  DemoConceptDetailView,
  DemoConceptsView,
  DemoSessionsView,
  DemoSessionDetailView,
  DemoSettingsView,
  DemoTagsView,
} from "../demo/DemoViews";
import { WeeklyAccuracyChart, type AccuracyRun } from "../components/WeeklyAccuracyChart";
import { ActivityLog, type ActivityEntry } from "../components/ActivityLog";
import { initials, displayName } from "../lib/userName";
import { quizStyleLabel } from "../lib/quizStyles";
import type { DemoBoard, DemoConcept, DemoPreset, DemoRun } from "../demo/demoData";

type View =
  | { name: "dashboard" }
  | { name: "board"; boardId: string }
  | { name: "concepts"; boardId: string }
  | { name: "concept"; boardId: string; conceptId: string }
  | { name: "tags"; boardId: string }
  | { name: "sessions"; boardId: string }
  | { name: "session"; boardId: string; runId: string }
  | { name: "settings"; boardId: string }
  | { name: "play"; boardId: string; presetId: string };

type Modal =
  | { kind: "new-board" }
  | { kind: "add-concept"; boardId: string }
  | { kind: "add-tag"; boardId: string }
  | { kind: "new-setting"; boardId: string }
  | { kind: "edit-setting"; boardId: string; presetId: string }
  | { kind: "start-session"; boardId: string }
  | null;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Relative label for a date, like "Today", "Yesterday", or "Aug 4". */
function lastUsedLabel(iso: string | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Short, readable date for the "last reviewed" line on a concept row. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Consecutive days with at least one run, ending today. */
function streakDays(runs: { createdAt: string }[]): number {
  const days = new Set(runs.map((r) => new Date(r.createdAt).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function Demo() {
  const navigate = useNavigate();
  const store = useDemoStore();
  const { state } = store;
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const { user, boards, tags, concepts, presets, runs } = state;

  // Scroll to top on every view change (the demo is a single page, so it
  // must reset scroll position itself rather than relying on the router).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const boardIdOfView =
    view.name === "board" || view.name === "concepts" || view.name === "concept" || view.name === "tags" || view.name === "sessions" || view.name === "session" || view.name === "settings" || view.name === "play"
      ? view.boardId
      : null;

  const activeBoard = boardIdOfView ? boards.find((b) => b.id === boardIdOfView) : null;

  const boardConcepts = useMemo(
    () => (activeBoard ? concepts.filter((c) => c.boardId === activeBoard.id) : []),
    [concepts, activeBoard]
  );
  const boardTags = useMemo(
    () => (activeBoard ? tags.filter((t) => t.boardId === activeBoard.id) : []),
    [tags, activeBoard]
  );
  const boardPresets = useMemo(
    () => (activeBoard ? presets.filter((p) => p.boardId === activeBoard.id) : []),
    [presets, activeBoard]
  );
  const boardRuns = useMemo(
    () => (activeBoard ? runs.filter((r) => r.boardId === activeBoard.id) : []),
    [runs, activeBoard]
  );

  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

  function showToast(title: string, body: string) {
    setToast({ title, body });
    window.setTimeout(() => setToast(null), 4000);
  }

  /** Record a finished quiz run in the store (navigation is handled by the quiz's done screen). */
  function finishQuiz(boardId: string, preset: DemoPreset, runData: { results: DemoRun["results"]; timeElapsedMs: number }) {
    const correct = runData.results.filter((r) => r.correct).length;
    store.recordRun({
      boardId,
      presetName: preset.name,
      style: preset.style,
      includeKnown: preset.includeKnown,
      tagIds: preset.tagIds,
      matchAllTags: preset.matchAllTags,
      exactMatching: preset.exactMatching,
      correctCount: correct,
      conceptsStudied: runData.results.length,
      timeElapsedMs: runData.timeElapsedMs,
      results: runData.results,
    });
    showToast(
      `Session complete — ${correct}/${runData.results.length} correct`,
      `${preset.name} · ${quizStyleLabel(preset.style)}`
    );
  }

  const activeConcept =
    view.name === "concept" ? boardConcepts.find((c) => c.id === view.conceptId) : undefined;
  const activeRun =
    view.name === "session" ? boardRuns.find((r) => r.id === view.runId) : undefined;
  const conceptById = useMemo(() => new Map(boardConcepts.map((c) => [c.id, c])), [boardConcepts]);
  const editingPreset =
    modal?.kind === "edit-setting" ? boardPresets.find((p) => p.id === modal.presetId) : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
      {/* ------------------------------- header ------------------------------ */}
      <DemoHeader
        user={user}
        currentBoard={activeBoard ?? undefined}
        activeNav={
          view.name === "concepts" || view.name === "concept"
            ? "concepts"
            : view.name === "tags"
              ? "tags"
              : view.name === "sessions" || view.name === "session"
                ? "sessions"
                : view.name === "settings"
                  ? "settings"
                  : undefined
        }
        onNavigateHome={() => navigate("/")}
        onNavigateBoard={() => activeBoard && setView({ name: "board", boardId: activeBoard.id })}
        onNavigate={(nav) => {
          if (!activeBoard) return;
          if (nav === "concepts") setView({ name: "concepts", boardId: activeBoard.id });
          if (nav === "tags") setView({ name: "tags", boardId: activeBoard.id });
          if (nav === "sessions") setView({ name: "sessions", boardId: activeBoard.id });
          if (nav === "settings") setView({ name: "settings", boardId: activeBoard.id });
        }}
        onSignup={() => navigate("/signup")}
        onReset={() => {
          store.resetDemo();
          setView({ name: "dashboard" });
          showToast("Demo reset", "Fresh starter data restored.");
        }}
      />

      <main className="max-w-7xl mx-auto px-8 py-8 flex flex-col gap-8 pb-24">
        {view.name === "dashboard" ? (
          <DashboardView
            state={state}
            onOpenBoard={(boardId) => setView({ name: "board", boardId })}
            onOpenSession={(boardId, runId) => setView({ name: "session", boardId, runId })}
            onNewBoard={() => setModal({ kind: "new-board" })}
          />
        ) : view.name === "play" && activeBoard ? (
          (() => {
            const preset = boardPresets.find((p) => p.id === view.presetId);
            if (!preset) {
              return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
                  <p className="text-sm">This saved setting no longer exists.</p>
                  <button onClick={() => setView({ name: "board", boardId: activeBoard.id })} className="text-primary text-sm hover:underline">
                    Back to board
                  </button>
                </div>
              );
            }
            return (
              <DemoQuiz
                state={state}
                board={activeBoard}
                preset={preset}
                tagNameById={tagNameById}
                onRecord={(runData) => finishQuiz(activeBoard.id, preset, runData)}
                onViewHistory={() => setView({ name: "sessions", boardId: activeBoard.id })}
                onQuit={() => setView({ name: "board", boardId: activeBoard.id })}
              />
            );
          })()
        ) : view.name === "concepts" && activeBoard ? (
          <DemoConceptsView
            board={activeBoard}
            concepts={boardConcepts}
            tagNameById={tagNameById}
            store={store}
            onBack={() => setView({ name: "board", boardId: activeBoard.id })}
            onAddConcept={() => setModal({ kind: "add-concept", boardId: activeBoard.id })}
            onOpenConcept={(conceptId) => setView({ name: "concept", boardId: activeBoard.id, conceptId })}
            onToast={showToast}
          />
        ) : view.name === "concept" && activeBoard && activeConcept ? (
          <DemoConceptDetailView
            board={activeBoard}
            concept={activeConcept}
            tagNameById={tagNameById}
            boardTags={boardTags}
            store={store}
            onBack={() => setView({ name: "concepts", boardId: activeBoard.id })}
            onToast={showToast}
          />
        ) : view.name === "tags" && activeBoard ? (
          <DemoTagsView
            board={activeBoard}
            tags={boardTags}
            concepts={boardConcepts}
            tagNameById={tagNameById}
            store={store}
            onBack={() => setView({ name: "board", boardId: activeBoard.id })}
            onNewTag={() => setModal({ kind: "add-tag", boardId: activeBoard.id })}
            onOpenConcept={(conceptId) => setView({ name: "concept", boardId: activeBoard.id, conceptId })}
            onToast={showToast}
          />
        ) : view.name === "sessions" && activeBoard ? (
          <DemoSessionsView
            board={activeBoard}
            runs={boardRuns}
            store={store}
            onBack={() => setView({ name: "board", boardId: activeBoard.id })}
            onOpenRun={(runId) => setView({ name: "session", boardId: activeBoard.id, runId })}
            onStartSession={() => setModal({ kind: "start-session", boardId: activeBoard.id })}
            onToast={showToast}
          />
        ) : view.name === "session" && activeBoard && activeRun ? (
          <DemoSessionDetailView
            board={activeBoard}
            run={activeRun}
            conceptById={conceptById}
            tagNameById={tagNameById}
            onBack={() => setView({ name: "sessions", boardId: activeBoard.id })}
            onOpenConcept={(conceptId) => setView({ name: "concept", boardId: activeBoard.id, conceptId })}
          />
        ) : view.name === "settings" && activeBoard ? (
          <DemoSettingsView
            board={activeBoard}
            presets={boardPresets}
            concepts={boardConcepts}
            boardTags={boardTags}
            store={store}
            onBack={() => setView({ name: "board", boardId: activeBoard.id })}
            onNewSetting={() => setModal({ kind: "new-setting", boardId: activeBoard.id })}
            onEditSetting={(presetId) => setModal({ kind: "edit-setting", boardId: activeBoard.id, presetId })}
            onRun={(preset) => setView({ name: "play", boardId: activeBoard.id, presetId: preset.id })}
            onDeleted={() => setView({ name: "dashboard" })}
            onToast={showToast}
          />
        ) : activeBoard ? (
          <BoardView
            board={activeBoard}
            concepts={boardConcepts}
            runs={boardRuns}
            tagNameById={tagNameById}
            onBack={() => setView({ name: "dashboard" })}
            onOpenConcepts={() => setView({ name: "concepts", boardId: activeBoard.id })}
            onOpenSessions={() => setView({ name: "sessions", boardId: activeBoard.id })}
            onOpenConcept={(conceptId) => setView({ name: "concept", boardId: activeBoard.id, conceptId })}
            onAddConcept={() => setModal({ kind: "add-concept", boardId: activeBoard.id })}
            onStartSession={() => setModal({ kind: "start-session", boardId: activeBoard.id })}
          />
        ) : null}
      </main>

      {/* ------------------------------- modals ------------------------------ */}
      {modal?.kind === "new-board" && (
        <DemoNewBoardModal
          open
          onClose={() => setModal(null)}
          onCreate={(input) => {
            const board = store.createBoard(input);
            setView({ name: "board", boardId: board.id });
            showToast("Board created", `"${board.title}" is ready for concepts.`);
          }}
        />
      )}

      {modal?.kind === "add-concept" && (
        <DemoAddConceptModal
          open
          boardTags={boardTags}
          onClose={() => setModal(null)}
          onCreate={(input) => {
            store.createConcept(modal.boardId, {
              title: input.title,
              answer: input.answer,
              hint: input.hint || null,
              learned: input.learned,
              tagIds: input.tagIds,
            });
            showToast("Concept added", `"${input.title}" was added to the board.`);
          }}
        />
      )}

      {modal?.kind === "add-tag" && (
        <DemoAddTagModal
          open
          existingNames={boardTags.map((t) => t.name)}
          onClose={() => setModal(null)}
          onCreate={(name) => {
            store.createTag(modal.boardId, name);
            showToast("Tag created", `Tag "${name}" is ready to use.`);
          }}
        />
      )}

      {modal?.kind === "new-setting" && (
        <DemoNewSettingModal
          key="new"
          open
          boardTags={boardTags}
          concepts={boardConcepts}
          onClose={() => setModal(null)}
          onSave={(input) => {
            store.createPreset(modal.boardId, input);
            showToast("Setting saved", `"${input.name}" is ready to start a session.`);
          }}
        />
      )}

      {modal?.kind === "edit-setting" && editingPreset && (
        <DemoNewSettingModal
          key={editingPreset.id}
          open
          boardTags={boardTags}
          concepts={boardConcepts}
          initial={editingPreset}
          onClose={() => setModal(null)}
          onSave={(input) => {
            store.updatePreset(editingPreset.id, input);
            showToast("Setting updated", `"${input.name}" was saved.`);
          }}
        />
      )}

      {modal?.kind === "start-session" && (
        <DemoStartSessionModal
          open
          presets={boardPresets}
          concepts={boardConcepts}
          boardTags={boardTags}
          onClose={() => setModal(null)}
          onStart={(preset) => {
            setModal(null);
            setView({ name: "play", boardId: modal.boardId, presetId: preset.id });
          }}
          onCreateSetting={() => setModal({ kind: "new-setting", boardId: modal.boardId })}
        />
      )}

      {/* ------------------------------- toast ------------------------------- */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 shadow-2xl shadow-black/40"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-foreground">{toast.title}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{toast.body}</p>
            </div>
            <button onClick={() => setToast(null)} className="ml-2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- header ------------------------------- */

function DemoHeader({
  user,
  currentBoard,
  activeNav,
  onNavigateHome,
  onNavigateBoard,
  onNavigate,
  onSignup,
  onReset,
}: {
  user: { name: string; email: string };
  currentBoard?: DemoBoard;
  /** Which board nav item is active (matches the real Navbar's active state). */
  activeNav?: "concepts" | "tags" | "sessions" | "settings";
  onNavigateHome: () => void;
  onNavigateBoard: () => void;
  onNavigate: (nav: "concepts" | "tags" | "sessions" | "settings") => void;
  onSignup: () => void;
  onReset: () => void;
}) {
  const navItems: { key: "concepts" | "tags" | "sessions" | "settings"; label: string; icon: React.ReactNode }[] = [
    { key: "concepts", label: "Concepts", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { key: "tags", label: "Tags", icon: <Tag className="w-3.5 h-3.5" /> },
    { key: "sessions", label: "Sessions", icon: <Clock className="w-3.5 h-3.5" /> },
    { key: "settings", label: "Settings", icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-8 h-18 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onNavigateHome} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="text-sm tracking-wide text-foreground">Learning Logs</span>
          </button>
          {currentBoard && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <button
                onClick={onNavigateBoard}
                className="text-sm text-foreground hover:text-primary transition-colors truncate max-w-[140px] sm:max-w-[220px]"
                style={{ color: currentBoard.color }}
              >
                {currentBoard.title}
              </button>
            </>
          )}
          <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
            <Sparkles className="w-2.5 h-2.5" />
            Demo
          </span>
        </div>

        {/* board nav — mirrors the real app's board links in the header */}
        {currentBoard && (
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeNav === item.key
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                {item.icon}
                <span className="hidden sm:block">{item.label}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3 ml-auto shrink-0">
          <button
            onClick={onReset}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={onSignup}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
          >
            Create account
          </button>
          <div className="relative group">
            <button
              disabled
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg opacity-45 cursor-not-allowed"
              aria-disabled="true"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                <span className="text-[10px] text-primary font-mono">{initials(user.name, user.email)}</span>
              </div>
              <span className="text-sm text-foreground hidden sm:block">{displayName(user.name, user.email)}</span>
            </button>
            <span className="absolute bottom-full mb-2 right-0 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground bg-card border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg shadow-black/40">
              Profile & settings are disabled in the demo
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------- dashboard view ----------------------------- */

type BoardFilter = "all" | "in-progress" | "completed";

function DashboardView({
  state,
  onOpenBoard,
  onOpenSession,
  onNewBoard,
}: {
  state: ReturnType<typeof useDemoStore>["state"];
  onOpenBoard: (boardId: string) => void;
  onOpenSession: (boardId: string, runId: string) => void;
  onNewBoard: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BoardFilter>("all");

  const learnedConcepts = state.concepts.filter((c) => c.learned).length;
  const totalConcepts = state.concepts.length;
  const pctComplete = totalConcepts === 0 ? 0 : Math.round((learnedConcepts / totalConcepts) * 100);
  const maxStreak = state.boards.length > 0 ? Math.max(...state.boards.map((b) => streakDays(state.runs.filter((r) => r.boardId === b.id)))) : 0;
  const completedBoards = state.boards.filter(
    (b) => {
      const bc = state.concepts.filter((c) => c.boardId === b.id);
      return bc.length > 0 && bc.every((c) => c.learned);
    }
  ).length;

  const filteredBoards = state.boards.filter((b) => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) || b.subject.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    const bc = state.concepts.filter((c) => c.boardId === b.id);
    if (filter === "completed") return bc.length > 0 && bc.every((c) => c.learned);
    if (filter === "in-progress") return bc.length === 0 || !bc.every((c) => c.learned);
    return true;
  });

  const boardTitle = (boardId: string) => state.boards.find((b) => b.id === boardId)?.title ?? "Board";
  const activityEntries: ActivityEntry[] = [...state.runs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((run) => ({
      id: run.id,
      boardId: run.boardId,
      type: "session",
      message: `${run.correctCount}/${run.conceptsStudied} correct · ${run.presetName}`,
      board: boardTitle(run.boardId),
      timestamp: formatDate(run.createdAt),
    }));

  return (
    <>
      {state.boards.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-4">
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
              {greeting()}, {displayName(state.user.name, state.user.email)}
            </h1>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              You don&apos;t have any boards yet. Create your first board to start capturing
              concepts, tracking streaks, and taking quizzes — all stored locally in this demo.
            </p>
            <button
              onClick={onNewBoard}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              Create your first board
            </button>
          </motion.div>
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">Dashboard</p>
            <h1 className="text-foreground">
              {greeting()}, {displayName(state.user.name, state.user.email)}
            </h1>
          </div>

          {/* summary stats — mirrors the real dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <DemoSummaryCard
              label="Concepts learned"
              value={`${learnedConcepts}/${totalConcepts}`}
              sub={`${pctComplete}% complete`}
              color="#7c6af7"
            />
            <DemoSummaryCard
              label="Total sessions"
              value={String(state.runs.length)}
              sub="across all boards"
              color="#4fb8f0"
            />
            <DemoSummaryCard
              label="Best streak"
              value={`${maxStreak}d`}
              sub="keep it up"
              color="#f07c4f"
              icon={<Flame className="w-3 h-3" />}
            />
            <DemoSummaryCard
              label="Boards mastered"
              value={`${completedBoards}/${state.boards.length}`}
              sub="fully completed"
              color="#4ff0b8"
            />
          </motion.div>

          {/* filters + search */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
              {(["all", "in-progress", "completed"] as BoardFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs capitalize transition-all ${
                    filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search boards…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-full sm:w-52 transition-all"
              />
            </div>
          </div>

          {/* board grid + activity */}
          <div className="flex flex-col gap-8">
            {filteredBoards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBoards.map((board, i) => (
                  <BoardCard key={board.id} board={board} index={i} state={state} onOpen={() => onOpenBoard(board.id)} />
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
              badge={`${state.runs.length} session${state.runs.length === 1 ? "" : "s"}`}
              onSelect={(entry) => onOpenSession(entry.boardId, entry.id)}
            />
          </div>

          {/* "why this is a demo" strip */}
          <div className="bg-secondary/40 border border-border rounded-xl px-5 py-4 flex flex-col gap-2">
            <p className="text-sm text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Everything here is a sandbox
            </p>
            <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
              You&apos;re signed in as <span className="text-foreground">{state.user.email}</span>. Boards, concepts, tags,
              and session settings are stored only in your browser. Create an account to save your real learning progress.
            </p>
          </div>
        </>
      )}
    </>
  );
}

function DemoSummaryCard({
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
  icon?: React.ReactNode;
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

/* ----------------------------- board card ----------------------------- */

function BoardCard({
  board,
  index,
  state,
  onOpen,
}: {
  board: DemoBoard;
  index: number;
  state: ReturnType<typeof useDemoStore>["state"];
  onOpen: () => void;
}) {
  const boardConcepts = state.concepts.filter((c) => c.boardId === board.id);
  const boardRuns = state.runs.filter((r) => r.boardId === board.id);
  const learned = boardConcepts.filter((c) => c.learned).length;
  const allLearned = boardConcepts.length > 0 && learned === boardConcepts.length;
  const progress = boardConcepts.length === 0 ? 0 : Math.round((learned / boardConcepts.length) * 100);
  const lastRun = [...boardRuns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const lastUsed = lastUsedLabel(lastRun?.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
      className="group relative bg-card border border-border rounded-xl p-5 flex flex-col gap-4 cursor-pointer hover:border-[rgba(124,106,247,0.35)] hover:bg-[#14162080] transition-all duration-200"
      onClick={onOpen}
    >
      <div className="absolute top-0 left-5 right-5 h-0.5 rounded-full opacity-70" style={{ background: board.color }} />

        <div className="flex items-start justify-between pt-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">{board.subject}</span>
            <h3 className="text-base text-foreground leading-snug">{board.title}</h3>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-muted-foreground">Open</span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-mono">{learned}/{boardConcepts.length} concepts</span>
          <span className="text-[11px] font-mono" style={{ color: board.color }}>{progress}%</span>
        </div>
        <div className="h-0.75 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: board.color }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <Stat icon={<BarChart2 className="w-3 h-3" />} label="sessions" value={boardRuns.length} />
        <Stat icon={<Flame className="w-3 h-3" />} label="streak" value={`${streakDays(boardRuns)}d`} />
        <Stat icon={<CheckCircle2 className="w-3 h-3" />} label="last used" value={lastUsed} small />
      </div>

      <div className="flex items-center gap-1.5 border-t border-border pt-3 mt-auto">
        {allLearned ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <span className={`text-[11px] font-mono ${allLearned ? "text-emerald-400" : "text-muted-foreground"}`}>
          {allLearned ? "All concepts learned" : `${boardConcepts.length - learned} remaining`}
        </span>
      </div>
    </motion.div>
  );
}

function Stat({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string | number; small?: boolean }) {
  return (
    <div className="flex flex-col gap-1 bg-secondary rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span className={`font-mono ${small ? "text-[11px]" : "text-sm"} text-foreground truncate`}>{value}</span>
    </div>
  );
}

/* ----------------------------- board view ----------------------------- */

function BoardView({
  board,
  concepts,
  runs,
  tagNameById,
  onBack,
  onOpenConcepts,
  onOpenSessions,
  onOpenConcept,
  onAddConcept,
  onStartSession,
}: {
  board: DemoBoard;
  concepts: DemoConcept[];
  runs: { correctCount: number; conceptsStudied: number; createdAt: string }[];
  tagNameById: Map<string, string>;
  onBack: () => void;
  onOpenConcepts: () => void;
  onOpenSessions: () => void;
  onOpenConcept: (conceptId: string) => void;
  onAddConcept: () => void;
  onStartSession: () => void;
}) {
  const learned = concepts.filter((c) => c.learned).length;
  const allLearned = concepts.length > 0 && learned === concepts.length;
  const progress = concepts.length === 0 ? 0 : Math.round((learned / concepts.length) * 100);
  const lastRun = [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const lastUsed = lastUsedLabel(lastRun?.createdAt);

  const runRows: AccuracyRun[] = runs.map((r) => ({
    correctCount: r.correctCount,
    conceptsStudied: r.conceptsStudied,
    createdAt: r.createdAt,
  }));

  return (
    <main className="flex flex-col gap-8">
      {/* back + header — mirrors the real BoardDetail header */}
      <div className="flex flex-col gap-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm w-fit">
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
            <h1 className="text-foreground">{board.title}</h1>
          </div>
          <button
            onClick={onStartSession}
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
        <DemoStatCard icon={<BookOpen className="w-4 h-4" />} label="Sessions" value={runs.length} color={board.color} />
        <DemoStatCard icon={<Flame className="w-4 h-4" />} label="Streak" value={`${streakDays(runs)}d`} color="#f07c4f" />
        <DemoStatCard icon={<CalendarDays className="w-3.5 h-3.5" />} label="Last used" value={lastUsed} color="#4fb8f0" />
        <DemoStatCard
          icon={<Trophy className="w-4 h-4" />}
          label="Status"
          value={allLearned ? "Mastered" : "In progress"}
          color={allLearned ? "#4ff0b8" : "#7c6af7"}
        />
      </motion.div>

      {/* overall progress */}
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
          {learned} of {concepts.length} concepts learned
        </p>
      </div>

      {/* weekly accuracy */}
      <WeeklyAccuracyChart boardId={board.id} runs={runRows} onViewSessions={onOpenSessions} />

      {/* concepts list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-x-3 md:justify-between">
          <h2 className="text-foreground">Concepts</h2>
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button
                disabled
                className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg border border-border text-xs text-muted-foreground opacity-45 cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload CSV
              </button>
              <span className="absolute bottom-full mb-2 right-0 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground bg-card border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg shadow-black/40">
                CSV upload is disabled in the demo
              </span>
            </div>
            <button
              onClick={onAddConcept}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 text-primary border border-primary/25 text-xs hover:bg-primary/25 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add concept
            </button>
          </div>
        </div>

        {concepts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
            <BookOpen className="w-7 h-7 opacity-30" />
            <p className="text-sm">No concepts yet. Add your first one.</p>
          </div>
        ) : (
          <>
            {/* Concepts scrollbox — ~6 rows visible, scroll inside for more. */}
            <div className="tag-scrollbox max-h-[480px] overflow-y-auto flex flex-col gap-2 pr-1 overscroll-contain rounded-xl">
              {concepts.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.04 }}
                  onClick={() => onOpenConcept(c.id)}
                  className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/30 transition-colors cursor-pointer group shrink-0"
                >
                  <div className="shrink-0">
                    {c.learned ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${c.learned ? "text-foreground" : "text-muted-foreground"}`}>{c.title}</p>
                    {c.tagIds.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {c.tagIds.map((id) => {
                          const name = tagNameById.get(id);
                          if (!name) return null;
                          return <span key={id} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">{name}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  {c.lastReviewed && (
                    <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden sm:block">
                      {formatDate(c.lastReviewed)}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
            {concepts.length > 6 && (
              <button
                onClick={onOpenConcepts}
                className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                View all {concepts.length} concepts
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function DemoStatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
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
