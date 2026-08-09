import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useNavigate } from "react-router";
import { GuestOnly } from "../components/GuestOnly";
import {
  ArrowRight,
  BarChart2,
  Braces,
  CheckCircle2,
  Circle,
  Crown,
  Database,
  Dna,
  FileText,
  Flame,
  Gamepad2,
  Globe,
  GraduationCap,
  Languages,
  LayoutGrid,
  Music,
  Palette,
  Play,
  Search,
  Sigma,
  Tag,
  Timer,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────
 * Public landing page. Pure marketing — nothing here is wired to the
 * API; every mock (dashboard, quiz, charts) is static or demo data.
 * ──────────────────────────────────────────────────────────────── */

const STUDIO_CSS = `
.mockup-marquee {
  mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent);
}
.mockup-marquee-track {
  animation: mockup-marquee-scroll 46s linear infinite;
  will-change: transform;
}
.mockup-marquee:hover .mockup-marquee-track {
  animation-play-state: paused;
}
@keyframes mockup-marquee-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.mockup-spotlight::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background: radial-gradient(
    340px circle at var(--spot-x, 50%) var(--spot-y, 50%),
    color-mix(in srgb, var(--primary) 15%, transparent),
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}
.mockup-spotlight:hover::before { opacity: 1; }
.mockup-underline path {
  stroke-dasharray: 320;
  stroke-dashoffset: 320;
  animation: mockup-draw 1.1s 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes mockup-draw {
  to { stroke-dashoffset: 0; }
}
`;

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

const SUBJECTS = [
  { icon: <Globe className="w-4 h-4" />, label: "Spanish" },
  { icon: <Braces className="w-4 h-4" />, label: "React" },
  { icon: <Sigma className="w-4 h-4" />, label: "Linear algebra" },
  { icon: <Music className="w-4 h-4" />, label: "Piano theory" },
  { icon: <Crown className="w-4 h-4" />, label: "Chess openings" },
  { icon: <Database className="w-4 h-4" />, label: "SQL" },
  { icon: <Dna className="w-4 h-4" />, label: "Immunology" },
  { icon: <Palette className="w-4 h-4" />, label: "Color theory" },
  { icon: <Gamepad2 className="w-4 h-4" />, label: "Game balance" },
  { icon: <Languages className="w-4 h-4" />, label: "Portuguese" },
];

const STEPS = [
  {
    title: "Capture concepts",
    body: "Break a subject into concept cards — a question, an answer in your own words, and tags. No more walls of notes you'll never re-open.",
  },
  {
    title: "Run focused sessions",
    body: "Pick a board and a filter — a tag, a difficulty, everything. Work through the cards and mark each one right or wrong.",
  },
  {
    title: "Build streaks",
    body: "A little every day beats a lot once a month. The app nudges you when your streak is on the line.",
  },
  {
    title: "Review the history",
    body: "Every session is logged. See your accuracy climb, revisit what you got wrong, and write notes next to the concepts.",
  },
];

/* ── helpers ──────────────────────────────────────────────────── */

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SpotlightCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
        el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
      }}
      className={`mockup-spotlight relative overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
      <span className="h-px w-6 bg-primary/50" />
      {children}
    </p>
  );
}

/* ── interactive quiz demo ────────────────────────────────────── */

const QUIZ_OPTIONS = [
  { label: "map()", correct: false },
  { label: "filter()", correct: true },
  { label: "reduce()", correct: false },
  { label: "forEach()", correct: false },
];

function QuizMock() {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/10 dark:shadow-black/30 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Session · Multiple choice
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">03 / 12</span>
      </div>

      <p className="text-sm text-foreground leading-relaxed">
        Which array method returns a <span className="text-primary">new</span> array containing only the
        elements that pass a test?
      </p>

      <div className="flex flex-col gap-2">
        {QUIZ_OPTIONS.map((opt) => {
          const isSelected = selected === opt.label;
          const showCorrect = answered && opt.correct;
          const showWrong = answered && isSelected && !opt.correct;
          return (
            <button
              key={opt.label}
              type="button"
              disabled={answered}
              onClick={() => setSelected(opt.label)}
              className={[
                "flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-all",
                "disabled:cursor-default",
                isSelected && !answered ? "border-primary/70 bg-primary/10" : "",
                showCorrect ? "border-emerald-400/70 bg-emerald-400/10 text-foreground" : "",
                showWrong ? "border-rose-400/70 bg-rose-400/10 text-foreground" : "",
                !isSelected && !answered ? "border-border bg-secondary/40 hover:border-primary/40" : "",
                !showCorrect && !showWrong && !isSelected ? "border-border bg-secondary/40" : "",
              ].join(" ")}
            >
              <span className="font-mono text-xs">{opt.label}</span>
              {showCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {showWrong && <X className="w-4 h-4 text-rose-400" />}
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {answered ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className={[
                "rounded-xl border px-4 py-3 text-xs leading-relaxed",
                selected === "filter()"
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : "border-border bg-secondary/50 text-muted-foreground",
              ].join(" ")}
            >
              {selected === "filter()"
                ? "Correct. filter() runs the callback for each element and keeps only the ones that return true."
                : `Not quite — filter() is the one. ${selected} returns something different.`}
            </div>
          </motion.div>
        ) : (
          <p className="text-[10px] font-mono text-muted-foreground">This demo is interactive — click an answer.</p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── hero app mock ────────────────────────────────────────────── */

const MOCK_BOARDS = [
  { subject: "Frontend", title: "React Fundamentals", progress: 100, color: "#7c6af7", learned: 41, total: 41 },
  { subject: "Architecture", title: "System Design", progress: 65, color: "#4fb8f0", learned: 26, total: 40 },
  { subject: "CS basics", title: "Algorithms & DS", progress: 37, color: "#f07c4f", learned: 15, total: 41 },
];

const MOCK_STATS = [
  { label: "Concepts", value: "125/244", color: "#7c6af7" },
  { label: "Sessions", value: "45", color: "#4fb8f0" },
  { label: "Streak", value: "18d", color: "#f07c4f" },
  { label: "Boards", value: "2/6", color: "#4ff0b8" },
];

function HeroAppMock() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 dark:shadow-black/50">
      {/* browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/40">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <div className="flex-1 mx-4 h-7 rounded-lg bg-secondary border border-border flex items-center gap-2 px-3">
          <Search className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] font-mono text-muted-foreground">app.learninglogs.com</span>
        </div>
      </div>

      {/* app body */}
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm text-foreground">Good morning, Will</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono bg-secondary border border-border rounded-lg px-3 py-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-foreground">18-day streak</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {MOCK_STATS.map((s) => (
            <div key={s.label} className="bg-secondary/60 border border-border rounded-xl px-3 py-2.5 flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">{s.label}</span>
              <span className="font-mono text-sm text-foreground">{s.value}</span>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          {MOCK_BOARDS.map((b) => (
            <div
              key={b.title}
              className="relative bg-secondary/60 border border-border rounded-xl p-3.5 flex flex-col gap-2.5 overflow-hidden"
            >
              <div
                className="absolute top-0 left-4 right-4 h-[2px] rounded-full"
                style={{ background: b.color }}
              />
              <div className="pt-1">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">{b.subject}</p>
                <p className="text-xs text-foreground mt-0.5">{b.title}</p>
              </div>
              <div className="h-1 rounded-full bg-card overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${b.progress}%`, background: b.color }} />
              </div>
              <div className="flex items-center gap-1.5">
                {b.progress === 100 ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Circle className="w-3 h-3 text-muted-foreground/40" />
                )}
                <span className="text-[9px] font-mono text-muted-foreground">
                  {b.progress === 100 ? "All learned" : `${b.progress}% complete`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── mini session chart ───────────────────────────────────────── */

const CHART = [
  { day: "M", value: 42 },
  { day: "T", value: 58 },
  { day: "W", value: 51 },
  { day: "T", value: 67 },
  { day: "F", value: 74 },
  { day: "S", value: 82 },
  { day: "S", value: 90 },
];

function MiniChart() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-2 h-36">
        {CHART.map((bar, i) => (
          <div key={bar.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <motion.div
              initial={{ height: 0 }}
              whileInView={{ height: `${bar.value}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }}
              className="w-full rounded-t-md"
              style={{
                background: i === CHART.length - 1 ? "var(--primary)" : "var(--secondary)",
                boxShadow: i === CHART.length - 1 ? "0 0 24px color-mix(in srgb, var(--primary) 35%, transparent)" : undefined,
              }}
            />
            <span className="text-[10px] font-mono text-muted-foreground">{bar.day}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          Accuracy up 48% since week one
        </span>
        <span className="font-mono">last 7 sessions</span>
      </div>
    </div>
  );
}

/* ── forgetting curve ─────────────────────────────────────────── */

function ForgettingCurve() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/5 dark:shadow-black/30 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/60" />
            Without review
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            With review
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">retention · 14 days</span>
      </div>

      <div className="relative pt-2">
        <svg viewBox="0 0 360 190" className="w-full" role="img" aria-label="Forgetting curve with and without review">
          {[38, 76, 114, 152].map((y) => (
            <line key={y} x1="20" x2="340" y1={y} y2={y} stroke="var(--border)" strokeDasharray="4 6" />
          ))}

          {/* without review — decays fast */}
          <motion.path
            d="M20 20 C 90 150, 180 165, 340 168"
            fill="none"
            stroke="color-mix(in srgb, var(--muted-foreground) 45%, transparent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />

          {/* with review — dips and recovers */}
          <motion.path
            d="M20 20 C 55 45, 65 38, 105 32 C 145 26, 160 32, 200 26 C 240 20, 260 26, 300 20 C 322 17, 332 18, 340 17"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, delay: 0.25, ease: "easeOut" }}
          />

          {/* end dots */}
          <motion.circle
            cx="340"
            cy="168"
            r="3.5"
            fill="color-mix(in srgb, var(--muted-foreground) 45%, transparent)"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.2 }}
          />
          <motion.circle
            cx="340"
            cy="17"
            r="3.5"
            fill="var(--primary)"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.6 }}
          />
        </svg>
        <div className="absolute -bottom-1 left-0 right-0 flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>day 0</span>
          <span>day 7</span>
          <span>day 14</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Left alone, memory decays fast. Each review — a session, a hint, a wrong answer — pulls the curve back up
        and flattens it a little more.
      </p>
    </div>
  );
}

/* ── the page ─────────────────────────────────────────────────── */

export function Landing() {
  const navigate = useNavigate();

  // Hero mouse parallax.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 55, damping: 20 });
  const sy = useSpring(my, { stiffness: 55, damping: 20 });
  const orbX = useTransform(sx, [-0.5, 0.5], [-30, 30]);
  const orbY = useTransform(sy, [-0.5, 0.5], [-30, 30]);
  const gridX = useTransform(sx, [-0.5, 0.5], [12, -12]);
  const gridY = useTransform(sy, [-0.5, 0.5], [12, -12]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <GuestOnly>
      <div
        className="min-h-screen bg-background text-foreground"
        style={{ fontFamily: "var(--font-sans)" }}
      >
      <style>{STUDIO_CSS}</style>

      {/* ── nav ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm tracking-wide text-foreground font-medium">Learning Logs</span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <button type="button" onClick={() => scrollTo("how")} className="hover:text-foreground transition-colors">
              How it works
            </button>
            <button type="button" onClick={() => scrollTo("why")} className="hover:text-foreground transition-colors">
              Why it works
            </button>
            <button type="button" onClick={() => scrollTo("features")} className="hover:text-foreground transition-colors">
              Features
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              Get started
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── hero ── */}
      <section
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          mx.set((e.clientX - rect.left) / rect.width - 0.5);
          my.set((e.clientY - rect.top) / rect.height - 0.5);
        }}
        className="relative overflow-hidden"
      >
        {/* texture: grid + orbs + grain */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            style={{ x: gridX, y: gridY }}
            className="absolute inset-0"
            aria-hidden="true"
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(to right, color-mix(in srgb, var(--primary) 8%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--primary) 8%, transparent) 1px, transparent 1px)",
                backgroundSize: "64px 64px",
                maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)",
                WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)",
              }}
            />
          </motion.div>
          <motion.div
            style={{ x: orbX, y: orbY }}
            className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full blur-3xl"
            aria-hidden="true"
          >
            <div
              className="w-full h-full rounded-full"
              style={{ background: "color-mix(in srgb, var(--primary) 22%, transparent)" }}
            />
          </motion.div>
          <motion.div
            style={{ x: orbX, y: orbY }}
            className="absolute top-40 -right-40 w-[460px] h-[460px] rounded-full blur-3xl"
            aria-hidden="true"
          >
            <div
              className="w-full h-full rounded-full"
              style={{ background: "color-mix(in srgb, #4fb8f0 18%, transparent)" }}
            />
          </motion.div>
          <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.05 }} aria-hidden="true" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-20 lg:pt-28 pb-16 lg:pb-24 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-10 items-center">
          {/* copy */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="flex flex-col gap-7"
          >
            <h1 className="text-5xl sm:text-6xl lg:text-[4.25rem] font-semibold tracking-tight leading-[1.04]">
              Learn anything.
              <br />
              <span className="relative inline-block text-primary">
                Remember everything.
                <svg
                  className="absolute -bottom-2 left-0 w-full text-primary/70"
                  viewBox="0 0 300 12"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    className="mockup-underline"
                    d="M3 9 C 70 3, 130 11, 200 6 S 285 4, 297 7"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed">
              Learning Logs turns what you're studying into concept cards, then quizzes you on them in focused
              sessions. Your notes finally do the remembering for you.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Start learning for free
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollTo("practice")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-sm text-foreground hover:border-primary/40 hover:bg-secondary/40 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <Play className="w-3 h-3 fill-current" />
                </span>
                Watch it work
              </button>
            </div>
          </motion.div>

          {/* product mock */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
            className="relative"
          >
            <HeroAppMock />

            {/* floating streak badge */}
            <motion.div
              animate={{ y: [0, -9, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-3 sm:-left-8 top-20"
            >
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xl shadow-black/20 dark:shadow-black/40">
                <div className="w-8 h-8 rounded-lg bg-amber-400/15 text-amber-400 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-sm text-foreground leading-none">18-day streak</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Personal best</span>
                </div>
              </div>
            </motion.div>

            {/* floating quiz badge */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
              className="absolute -right-3 sm:-right-8 -bottom-6"
            >
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xl shadow-black/20 dark:shadow-black/40">
                <div className="w-8 h-8 rounded-lg bg-emerald-400/15 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-sm text-foreground leading-none">4/5 correct</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Spanish · verbs</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── marquee ── */}
      <section className="border-y border-border py-10 bg-secondary/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 mb-6">
          <Eyebrow>Make a board for anything</Eyebrow>
        </div>
        <div className="mockup-marquee relative overflow-hidden">
          <div className="mockup-marquee-track flex w-max items-center gap-3 px-3">
            {[...SUBJECTS, ...SUBJECTS].map((s, i) => (
              <div
                key={`${s.label}-${i}`}
                className="flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground whitespace-nowrap"
              >
                <span className="text-primary/70">{s.icon}</span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ── */}
      <section id="how" className="max-w-7xl mx-auto px-6 lg:px-8 py-24">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16">
          <Reveal className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              A loop, not a wall of notes.
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-sm">
              The whole point is that you keep coming back. Each step feeds the next, and the session history
              shows you the payoff.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Zap className="w-3.5 h-3.5 text-primary" />
              roughly 10 minutes a day
            </div>
          </Reveal>

          <div className="flex flex-col gap-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.06}>
                <SpotlightCard className="bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                  <div className="flex items-center gap-4 sm:flex-col sm:gap-2 sm:items-start">
                    <span className="font-mono text-2xl text-primary/40">0{i + 1}</span>
                    {i < STEPS.length - 1 && (
                      <div className="hidden sm:block w-px h-full min-h-12 bg-border" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-lg text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── why it works: repetition ── */}
      <section id="why" className="border-t border-border bg-secondary/15">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="flex flex-col gap-5 order-2 lg:order-1">
            <Reveal>
              <Eyebrow>Why it works</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                Repetition is the heart of really learning.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-muted-foreground leading-relaxed max-w-md">
                Reading something once feels like learning. It isn't — left alone, most of it is gone within a
                day. The fix isn't intelligence, it's coming back. Every review flattens the forgetting curve a
                little more, and the spacing is what makes it stick.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                {[
                  "Sessions force you to recall, not just recognize",
                  "Streaks keep the spacing honest — a little, often",
                  "History shows you the curve flattening",
                ].map((li) => (
                  <li key={li} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {li}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={0.1} className="order-1 lg:order-2">
            <ForgettingCurve />
          </Reveal>
        </div>
      </section>

      {/* ── features ── */}
      <section id="features" className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24 flex flex-col gap-24">
          <div className="max-w-xl flex flex-col gap-4">
            <Eyebrow>What it does</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              Three habits, one app.
            </h2>
          </div>

          {/* feature 1 — capture */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <Reveal className="order-2 lg:order-1">
              <SpotlightCard className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/5 dark:shadow-black/30">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    React Fundamentals · concept 12/41
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-emerald-400">Learned</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>
                <p className="text-sm text-foreground font-medium leading-relaxed">
                  Why does the callback passed to <span className="font-mono text-primary">useEffect</span> run
                  after every render?
                </p>
                <div className="mt-4 rounded-xl bg-secondary/60 border border-border px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                  Effects run after paint so the browser can show the DOM first. The dependency array is just an
                  optimisation — not a guarantee.
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-[10px] font-mono text-foreground">
                    <Tag className="w-3 h-3 text-primary" />
                    hooks
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-[10px] font-mono text-foreground">
                    <Tag className="w-3 h-3 text-primary" />
                    lifecycle
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-[10px] font-mono text-foreground">
                    <Tag className="w-3 h-3 text-primary" />
                    got-wrong-2x
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
            <div className="order-1 lg:order-2 flex flex-col gap-5">
              <Reveal>
                <Eyebrow>01 · Capture</Eyebrow>
              </Reveal>
              <Reveal delay={0.05}>
                <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
                  Write the answer in your own words.
                </h3>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="text-muted-foreground leading-relaxed max-w-md">
                  Each concept is a question, an answer, a hint, and tags. Paraphrasing forces you to compress the
                  idea — which is where the remembering actually happens.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                  {[
                    "Import concepts from a CSV in one go",
                    "Tag by topic, difficulty, or how often you miss it",
                    "Mark concepts learned as they stick",
                  ].map((li) => (
                    <li key={li} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {li}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>

          {/* feature 2 — practice (interactive) */}
          <div id="practice" className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="flex flex-col gap-5">
              <Reveal>
                <Eyebrow>02 · Practice</Eyebrow>
              </Reveal>
              <Reveal delay={0.05}>
                <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
                  Sessions quiz you. That's the whole trick.
                </h3>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="text-muted-foreground leading-relaxed max-w-md">
                  Pick a board and a filter — a tag, a difficulty, everything. Work the cards, mark each one right
                  or wrong, and the app keeps score. Try the demo.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                  {[
                    "Multiple choice, type-in, or true/false",
                    "Hints when you're stuck — revealed only if you ask",
                    "Filter to the tags you're shaky on",
                  ].map((li) => (
                    <li key={li} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {li}
                    </li>
                  ))}
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <QuizMock />
            </Reveal>
          </div>

          {/* feature 3 — review */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <Reveal className="order-2 lg:order-1">
              <SpotlightCard className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/5 dark:shadow-black/30 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Correct answers · all boards
                  </span>
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-1">
                    <BarChart2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-mono text-emerald-400">90% today</span>
                  </div>
                </div>
                <MiniChart />
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">12 sessions this week</span>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    View history
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </SpotlightCard>
            </Reveal>
            <div className="order-1 lg:order-2 flex flex-col gap-5">
              <Reveal>
                <Eyebrow>03 · Review</Eyebrow>
              </Reveal>
              <Reveal delay={0.05}>
                <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
                  Watch the line go up.
                </h3>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="text-muted-foreground leading-relaxed max-w-md">
                  Every session is logged with its score and duration. Accuracy trends, best streaks, and the
                  concepts you keep missing are all one glance away.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
                  {[
                    "Per-session breakdown: right, wrong, and skipped",
                    "Streaks keep you honest",
                    "Write study logs next to any board",
                  ].map((li) => (
                    <li key={li} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {li}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 sm:px-16 sm:py-20 text-center flex flex-col items-center gap-6">
            <div
              className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[320px] rounded-full blur-3xl"
              style={{ background: "color-mix(in srgb, var(--primary) 25%, transparent)" }}
              aria-hidden="true"
            />
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.05 }} aria-hidden="true" />

            <div className="relative w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div className="relative flex flex-col items-center gap-4">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight max-w-lg">
                Your future self will thank you.
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md leading-relaxed">
                Start with one board and a single concept. In a month, that's thirty days of progress you can point to.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="relative flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
            >
              Start learning for free
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="relative text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Free while it's in beta · No credit card · Export anytime
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 flex flex-col md:flex-row gap-10 md:items-start md:justify-between">
          <div className="flex flex-col gap-2 max-w-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                <GraduationCap className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Learning Logs</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The notes app that quizzes you back. Built by someone who kept forgetting everything.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Product</span>
              {[
                { label: "How it works", target: "how" },
                { label: "Why it works", target: "why" },
                { label: "Features", target: "features" },
              ].map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => scrollTo(l.target)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Company</span>
              {["Privacy", "Terms", "Contact"].map((l) => (
                <button key={l} type="button" className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left">
                  {l}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Status</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                All systems operational
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileText className="w-3.5 h-3.5" />
                v0.1.3
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono">
            <span>© 2026 Learning Logs</span>
            <span>Remember the thing you read yesterday.</span>
          </div>
        </div>
      </footer>
      </div>
    </GuestOnly>
  );
}
