import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, CheckCircle2, Clock, CornerDownLeft, Flame, Lightbulb, MousePointerClick, X, XCircle,
} from "lucide-react";
import { isExactMatch, isLenientMatch, normalize } from "../lib/matching";
import { QUIZ_STYLE_OPTIONS, quizStyleLabel } from "../lib/quizStyles";
import type { DemoConcept, DemoPreset, DemoRunResult, DemoState } from "./demoData";

type Phase = "question" | "revealed" | "done";

type DemoQuestion = {
  conceptId: string;
  style: DemoPreset["style"];
  prompt: string;
  hint: string | null;
  /** multiple_choice — includes the correct answer among the options. */
  options?: string[];
  /** true_false — the statement to judge. */
  statement?: string;
};

/** "3m 24s" / "45s" from seconds. */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate questions for the demo from the board's concepts, mirroring the
 * backend engine's shape: a single style per run, tag filter, include-known.
 * Multiple choice picks 3 random distractor answers; true/false shows the real
 * answer (True) or another concept's answer (False); fill-in just asks.
 */
function generateQuestions(
  state: DemoState,
  boardId: string,
  preset: DemoPreset,
  tagNameById: Map<string, string>
): DemoQuestion[] {
  const boardConcepts = state.concepts.filter((c) => c.boardId === boardId);
  const selectedTagNames = (preset.tagIds ?? []).map((id) => tagNameById.get(id)).filter((n): n is string => Boolean(n));

  const eligible = boardConcepts.filter((c) => {
    if (!preset.includeKnown && c.learned) return false;
    if (selectedTagNames.length === 0) return true;
    const conceptTags = new Set(c.tagIds.map((id) => tagNameById.get(id)).filter((n): n is string => Boolean(n)));
    if (preset.matchAllTags) return selectedTagNames.every((n) => conceptTags.has(n));
    return selectedTagNames.some((n) => conceptTags.has(n));
  });

  const picked = shuffle(eligible).slice(0, 5);

  return picked.map((concept) => {
    const base = { conceptId: concept.id, prompt: concept.title, hint: concept.hint };
    if (preset.style === "multiple_choice") {
      // 3 random distractor answers from the whole pool, excluding this one.
      const others = boardConcepts.filter((c) => c.id !== concept.id && c.answer !== concept.answer);
      const distractors = shuffle(others).slice(0, 3).map((c) => c.answer);
      return { ...base, style: "multiple_choice" as const, options: shuffle([concept.answer, ...distractors]) };
    }
    if (preset.style === "true_false") {
      // Half the time show the real answer (True), otherwise a decoy (False).
      const decoy = shuffle(boardConcepts.filter((c) => c.id !== concept.id && c.answer !== concept.answer))[0];
      const statement = Math.random() < 0.5 ? concept.answer : (decoy?.answer ?? concept.answer);
      return { ...base, style: "true_false" as const, statement };
    }
    return { ...base, style: "fill_in" as const };
  });
}

export function DemoQuiz({
  state,
  board,
  preset,
  tagNameById,
  onRecord,
  onViewHistory,
  onQuit,
}: {
  state: DemoState;
  board: { id: string; color: string; title: string };
  preset: DemoPreset;
  tagNameById: Map<string, string>;
  /** Called exactly once when the run completes (or is ended early with answers) — the parent persists it. */
  onRecord: (run: { results: DemoRunResult[]; timeElapsedMs: number }) => void;
  /** Navigate to the sessions history list. */
  onViewHistory: () => void;
  /** Navigate back to the board. */
  onQuit: () => void;
}) {
  const boardColor = board.color ?? "#7c6af7";
  const exactMatching = preset.exactMatching;
  const conceptById = useMemo(
    () => new Map(state.concepts.filter((c) => c.boardId === board.id).map((c) => [c.id, c])),
    [state.concepts, board.id]
  );

  // Generate once per mount — keyed by board+preset from the parent.
  const questions = useMemo<DemoQuestion[]>(
    () => generateQuestions(state, board.id, preset, tagNameById),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board.id, preset.id]
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<DemoRunResult[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [tfSelected, setTfSelected] = useState<boolean | null>(null);
  const [writtenInput, setWrittenInput] = useState("");
  const [inputVerdict, setInputVerdict] = useState<boolean | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [quitting, setQuitting] = useState(false);

  const elapsedRef = useRef(0);
  const advanceTimer = useRef<number | null>(null);
  const recordedRef = useRef(false);

  const current = questions[index] ?? null;
  const total = questions.length;
  const progress = total > 0 ? index / total : 0;

  // Elapsed timer — runs while a quiz is in progress.
  useEffect(() => {
    if (phase === "done" || total === 0) return;
    const timer = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, total]);

  // Clear any pending auto-advance on unmount.
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    []
  );

  function scheduleAdvance(delayMs: number) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      advance();
    }, delayMs);
  }

  /** Persist the run exactly once (from the normal completion or early end). */
  function recordRunOnce() {
    if (recordedRef.current || results.length === 0) return;
    recordedRef.current = true;
    onRecord({ results, timeElapsedMs: elapsedRef.current * 1000 });
  }

  function advance() {
    if (index + 1 >= total) {
      recordRunOnce();
      setPhase("done");
      return;
    }
    setSelectedOption(null);
    setTfSelected(null);
    setWrittenInput("");
    setInputVerdict(null);
    setHintOpen(false);
    setPhase("question");
    setIndex((i) => i + 1);
  }

  // Enter-to-skip (and tap-to-skip on touch devices) while a result is shown.
  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });
  const quittingRef = useRef(quitting);
  useEffect(() => {
    quittingRef.current = quitting;
  }, [quitting]);

  useEffect(() => {
    if (phase !== "revealed") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (quittingRef.current) return;
      e.preventDefault();
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
      advanceRef.current();
    }
    // On touch devices, a tap anywhere skips the reveal wait and jumps to the
    // next question, mirroring the Enter shortcut. Taps on interactive
    // elements are ignored so tapping a button (e.g. quit) doesn't also
    // advance.
    function onTouchEnd(e: TouchEvent) {
      if (quittingRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest("button, a, input, textarea, select, [role='button']")) return;
      e.preventDefault();
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
      advanceRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [phase]);

  function endEarly() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setQuitting(false);
    if (results.length === 0) {
      onQuit();
      return;
    }
    recordRunOnce();
    setPhase("done");
  }

  function handleTFSelect(saysTrue: boolean) {
    if (phase !== "question" || !current || current.statement === undefined) return;
    const concept = conceptById.get(current.conceptId);
    const isTrue = normalize(current.statement) === normalize(concept?.answer ?? "");
    const correct = saysTrue === isTrue;
    setTfSelected(saysTrue);
    setPhase("revealed");
    setResults((prev) => [...prev, { conceptId: current.conceptId, correct }]);
    scheduleAdvance(1600);
  }

  function handleOptionSelect(option: string) {
    if (phase !== "question" || !current || current.options === undefined) return;
    const concept = conceptById.get(current.conceptId);
    const correct = normalize(option) === normalize(concept?.answer ?? "");
    setSelectedOption(option);
    setPhase("revealed");
    setResults((prev) => [...prev, { conceptId: current.conceptId, correct }]);
    scheduleAdvance(1400);
  }

  function handleCheckInput() {
    if (phase !== "question" || !current || !writtenInput.trim()) return;
    const concept = conceptById.get(current.conceptId);
    const correct = exactMatching
      ? isExactMatch(concept?.answer ?? "", writtenInput.trim())
      : isLenientMatch(concept?.answer ?? "", writtenInput.trim());
    setInputVerdict(correct);
    setPhase("revealed");
    setResults((prev) => [...prev, { conceptId: current.conceptId, correct }]);
    scheduleAdvance(2400);
  }

  const correctCount = results.filter((r) => r.correct).length;
  const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
  const accuracyColor = accuracy >= 80 ? "#4ff0b8" : accuracy >= 50 ? "#f0c94f" : "#f07c4f";

  // ── Empty pool ────────────────────────────────────────────────────────────
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-8">
        <BookOpen className="w-10 h-10 text-muted-foreground" />
        <div>
          <p className="text-foreground">No concepts match this session setting</p>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Try adjusting the tag filter or including learned concepts.
          </p>
        </div>
        <button
          onClick={onQuit}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          Back to board
        </button>
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 flex flex-col gap-8 items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-2"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
            style={{ background: `${accuracyColor}20` }}
          >
            {accuracy >= 80 ? (
              <CheckCircle2 className="w-8 h-8" style={{ color: accuracyColor }} />
            ) : accuracy >= 50 ? (
              <Flame className="w-8 h-8" style={{ color: accuracyColor }} />
            ) : (
              <XCircle className="w-8 h-8" style={{ color: accuracyColor }} />
            )}
          </div>
          <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono">Session complete</p>
          <h1 className="text-foreground">{preset.name}</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="w-full bg-card border border-border rounded-2xl p-6 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Accuracy</span>
              <span className="font-mono" style={{ color: accuracyColor }}>{accuracy}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${accuracy}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                className="h-full rounded-full"
                style={{ background: accuracyColor }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Concepts", value: String(results.length), color: boardColor },
              { label: "Correct", value: String(correctCount), color: "#4ff0b8" },
              { label: "Time", value: formatTime(elapsed), color: "#4fb8f0" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1 bg-secondary rounded-xl px-3 py-2.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{s.label}</span>
                <span className="font-mono text-sm" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="flex flex-col gap-3 w-full"
        >
          <button onClick={onViewHistory} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">
            View session history
          </button>
          <button onClick={onQuit} className="w-full py-3 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground hover:border-primary/30 transition-colors">
            Back to board
          </button>
        </motion.div>
      </div>
    );
  }

  const concept = current ? conceptById.get(current.conceptId) : undefined;
  const style = preset.style;

  // ── Active session ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6 min-h-[calc(100vh-4.5rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-4">
        <button onClick={() => setQuitting(true)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label="Quit session">
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: boardColor }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>

        <span className="text-xs font-mono text-muted-foreground shrink-0">{index + 1} / {total}</span>
        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3" />
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Question-type tag */}
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-foreground shadow-sm w-fit cursor-default select-none">
        {QUIZ_STYLE_OPTIONS.find((o) => o.id === style)?.icon}
        <span>{quizStyleLabel(style)}</span>
      </span>

      {/* Tags */}
      {concept && concept.tagIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {concept.tagIds.map((id) => {
            const name = tagNameById.get(id);
            if (!name) return null;
            return <span key={id} className="text-[10px] px-2.5 py-1 rounded-full bg-secondary text-muted-foreground font-mono">{name}</span>;
          })}
        </div>
      )}

      {/* Question area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${index}-${style}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="flex flex-col gap-5 flex-1"
        >
          {style === "true_false" && current && current.statement !== undefined && (
            <TrueFalseMode
              concept={concept}
              statement={current.statement}
              phase={phase}
              selected={tfSelected}
              onSelect={handleTFSelect}
              boardColor={boardColor}
            />
          )}

          {style === "multiple_choice" && current && current.options !== undefined && (
            <MultipleChoiceMode
              concept={concept}
              options={current.options}
              phase={phase}
              selectedOption={selectedOption}
              onSelect={handleOptionSelect}
            />
          )}

          {style === "fill_in" && current && (
            <InputAnswerMode
              concept={concept}
              phase={phase}
              input={writtenInput}
              onInputChange={setWrittenInput}
              onCheck={handleCheckInput}
              verdict={inputVerdict}
            />
          )}

          {current?.hint && (
            <div className="flex flex-col gap-2">
              {hintOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col gap-1.5 px-4 py-3 rounded-xl bg-card border border-border"
                >
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                    <Lightbulb className="w-3 h-3" />
                    Hint
                  </span>
                  <p className="text-sm text-foreground leading-relaxed">{current.hint}</p>
                </motion.div>
              ) : phase === "question" ? (
                <button
                  onClick={() => setHintOpen(true)}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Show hint
                </button>
              ) : null}
            </div>
          )}

          {phase === "revealed" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.35 }}
              className="flex items-center justify-center gap-2 pt-1 text-muted-foreground"
            >
              <span className="w-6 h-6 rounded-md border border-border flex items-center justify-center">
                <MousePointerClick className="w-3.5 h-3.5 sm:hidden" />
                <CornerDownLeft className="w-3.5 h-3.5 hidden sm:block" />
              </span>
              <span className="text-xs font-mono tracking-wide sm:hidden">Tap to go to next question</span>
              <span className="text-xs font-mono tracking-wide hidden sm:block">Press Enter to continue</span>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Quit confirm */}
      <AnimatePresence>
        {quitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setQuitting(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl shadow-black/50"
            >
              <h2 className="text-foreground">End session?</h2>
              <p className="text-sm text-muted-foreground">
                {results.length > 0
                  ? `You've answered ${results.length} of ${total} concepts. End now to save your progress, or quit to discard it.`
                  : `You've reviewed ${index} of ${total} concepts with nothing answered yet — ending will just leave the session.`}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={endEarly}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  End session & save
                </button>
                <button
                  onClick={() => setQuitting(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground hover:border-primary/30 transition-colors"
                >
                  Keep going
                </button>
                <button
                  onClick={onQuit}
                  className="flex-1 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 text-sm hover:bg-rose-500/10 transition-colors"
                >
                  Quit without saving
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── True / False ───────────────────────────────────────────────────────────
function TrueFalseMode({
  concept,
  statement,
  phase,
  selected,
  onSelect,
  boardColor,
}: {
  concept: DemoConcept | undefined;
  statement: string;
  phase: Phase;
  selected: boolean | null;
  onSelect: (value: boolean) => void;
  boardColor: string;
}) {
  const revealed = phase === "revealed";
  const isTrue = normalize(statement) === normalize(concept?.answer ?? "");
  const userCorrect = selected !== null && selected === isTrue;

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-1 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.75" style={{ background: boardColor }} />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono pt-1">Concept</span>
        <p className="text-xl text-foreground leading-snug mt-1" style={{ fontWeight: 500 }}>{concept?.title ?? "…"}</p>
      </div>

      <div className={`rounded-2xl border p-6 flex flex-col gap-2 transition-colors ${
        !revealed ? "bg-secondary border-border" : isTrue ? "bg-emerald-500/8 border-emerald-500/30" : "bg-rose-500/8 border-rose-500/30"
      }`}>
        <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Is this statement true or false?</span>
        <p className="text-base text-foreground leading-relaxed">{statement}</p>
        {revealed && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className={`text-xs font-mono mt-1 ${isTrue ? "text-emerald-400" : "text-rose-400"}`}
          >
            {isTrue ? "This is the correct answer" : `Correct answer: ${concept?.answer}`}
          </motion.p>
        )}
      </div>

      {!revealed ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelect(false)}
            className="flex items-center justify-center gap-2 py-4 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors text-sm"
          >
            <XCircle className="w-4 h-4" />
            False
          </button>
          <button
            onClick={() => onSelect(true)}
            className="flex items-center justify-center gap-2 py-4 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors text-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            True
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
          className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-mono ${
            userCorrect ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}
        >
          {userCorrect ? <><CheckCircle2 className="w-4 h-4" /> Correct — moving on</> : <><XCircle className="w-4 h-4" /> Incorrect — moving on</>}
        </motion.div>
      )}
    </div>
  );
}

// ── Multiple choice ────────────────────────────────────────────────────────
function MultipleChoiceMode({
  concept,
  options,
  phase,
  selectedOption,
  onSelect,
}: {
  concept: DemoConcept | undefined;
  options: string[];
  phase: Phase;
  selectedOption: string | null;
  onSelect: (option: string) => void;
}) {
  const revealed = phase === "revealed";

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-card border border-border rounded-2xl p-8">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Choose the correct answer</span>
        <p className="text-xl text-foreground leading-snug mt-2" style={{ fontWeight: 500 }}>{concept?.title ?? "…"}</p>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((option, i) => {
          const isCorrect = normalize(option) === normalize(concept?.answer ?? "");
          const isSelected = option === selectedOption;

          let cls = "border-border text-foreground hover:border-primary/40 hover:bg-primary/5";
          if (revealed && isCorrect) cls = "border-emerald-500/50 bg-emerald-500/10 text-emerald-300";
          else if (revealed && isSelected && !isCorrect) cls = "border-rose-500/50 bg-rose-500/10 text-rose-300";
          else if (revealed) cls = "border-border text-muted-foreground opacity-40";

          return (
            <button
              key={i}
              onClick={() => onSelect(option)}
              disabled={revealed}
              className={`flex items-center gap-4 px-5 py-4 rounded-xl border text-sm text-left transition-all duration-300 ${cls}`}
            >
              <span className={`w-6 h-6 rounded-full border shrink-0 flex items-center justify-center text-[11px] font-mono transition-colors duration-300 ${
                revealed && isCorrect
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                  : revealed && isSelected
                    ? "border-rose-500 bg-rose-500/20 text-rose-400"
                    : "border-border text-muted-foreground"
              }`}>
                {revealed && isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : revealed && isSelected ? <XCircle className="w-3.5 h-3.5" /> : String.fromCharCode(65 + i)}
              </span>
              {option}
            </button>
          );
        })}
      </div>

      {revealed && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.15 }}
          className="text-xs text-muted-foreground font-mono text-center"
        >
          Next concept in a moment…
        </motion.p>
      )}
    </div>
  );
}

// ── Input answer ───────────────────────────────────────────────────────────
function InputAnswerMode({
  concept,
  phase,
  input,
  onInputChange,
  onCheck,
  verdict,
}: {
  concept: DemoConcept | undefined;
  phase: Phase;
  input: string;
  onInputChange: (value: string) => void;
  onCheck: () => void;
  verdict: boolean | null;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-card border border-border rounded-2xl p-8">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Type your answer</span>
        <p className="text-xl text-foreground leading-snug mt-2" style={{ fontWeight: 500 }}>{concept?.title ?? "…"}</p>
      </div>

      {phase === "question" && (
        <div className="flex flex-col gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                e.preventDefault();
                onCheck();
              }
            }}
            placeholder="Write your answer here… (Enter to check)"
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none transition-all"
            style={{ fontFamily: "var(--font-sans)" }}
          />
          <button
            onClick={onCheck}
            disabled={!input.trim()}
            className="self-end px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Check answer
          </button>
        </div>
      )}

      {phase === "revealed" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 bg-card border border-border rounded-xl p-4">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Your answer</span>
              <p className="text-sm text-foreground leading-relaxed">{input.trim() || <span className="italic text-muted-foreground">No answer entered</span>}</p>
            </div>
            <div className="flex flex-col gap-1.5 bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-4">
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono">Correct answer</span>
              <p className="text-sm text-foreground leading-relaxed">{concept?.answer}</p>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-mono ${
              verdict ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}
          >
            {verdict ? <><CheckCircle2 className="w-4 h-4" /> Correct — moving on</> : <><XCircle className="w-4 h-4" /> Incorrect — moving on</>}
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}
