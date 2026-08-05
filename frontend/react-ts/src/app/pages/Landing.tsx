import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  GraduationCap, BookOpen, Tag, RotateCcw, FileText,
  CheckCircle2, BarChart2, Flame, ArrowRight, Zap,
} from "lucide-react";
import { GuestOnly } from "../components/GuestOnly";

const FEATURES = [
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: "Concept boards",
    description: "Organise what you're learning into boards. Each concept has an answer, tags, and a learned status you track over time.",
    color: "#7c6af7",
  },
  {
    icon: <RotateCcw className="w-5 h-5" />,
    title: "Focused sessions",
    description: "Configure sessions to include only what you need — filter by tag, exclude concepts you've already mastered, or do a full sweep.",
    color: "#4fb8f0",
  },
  {
    icon: <BarChart2 className="w-5 h-5" />,
    title: "Session history",
    description: "Every session is logged. See which concepts you got right or wrong, your accuracy over time, and how long you spent.",
    color: "#f07c4f",
  },
  {
    icon: <Tag className="w-5 h-5" />,
    title: "Tags",
    description: "Tag every concept with topics, difficulty signals, or any label you choose. Filter boards and sessions by tags to stay focused.",
    color: "#4ff0b8",
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: "Study logs",
    description: "Write freeform notes attached to each board. Capture insights, things that tripped you up, or reminders for next time.",
    color: "#f04fb0",
  },
  {
    icon: <Flame className="w-5 h-5" />,
    title: "Streaks & progress",
    description: "Track daily study streaks, overall concept completion, and session counts per board. Stay consistent and see yourself improve.",
    color: "#f0c94f",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Create a board", body: "Add a board for any subject you're studying — a course, a book, a skill, or a tech stack." },
  { step: "02", title: "Add concepts", body: "Break the subject into discrete concepts. Write the answer or explanation in your own words and tag each one." },
  { step: "03", title: "Run sessions", body: "Pick a session setting, work through your concepts, and mark each one right or wrong." },
  { step: "04", title: "Review & improve", body: "Check your session history, revisit weak concepts, and write logs to capture what you're learning." },
];

export function Landing() {
  const navigate = useNavigate();

  return (
    <GuestOnly>
      <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
      {/* nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-8 h-[4.5rem] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="text-sm tracking-wide text-foreground">Learning Logs</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/login")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >Sign in</button>
            <button onClick={() => navigate("/signup")}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              Get started
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="max-w-7xl mx-auto px-8 pt-24 pb-20 flex flex-col items-center text-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono">
            <Zap className="w-3 h-3" />
            Active recall, built for how you actually study
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl text-foreground max-w-3xl leading-tight" style={{ fontWeight: 600 }}>
            Learn anything.<br />
            <span style={{ color: "var(--primary)" }}>Remember everything.</span>
          </h1>

          <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
            Learning Logs turns your study material into structured concept boards. Run focused sessions, track what you know, and build a clear record of your progress — one concept at a time.
          </p>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button onClick={() => navigate("/signup")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start learning for free
              <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => navigate("/app")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              View demo
            </button>
          </div>
        </motion.div>

        {/* mock dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-4xl mt-4"
        >
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-[#4fb8f0] to-[#4ff0b8]" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Concepts learned", value: "125/244", color: "#7c6af7" },
                { label: "Sessions run", value: "45", color: "#4fb8f0" },
                { label: "Best streak", value: "18d", color: "#f07c4f" },
                { label: "Boards mastered", value: "2/6", color: "#4ff0b8" },
              ].map((card) => (
                <div key={card.label} className="bg-secondary border border-border rounded-xl px-4 py-3 flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{card.label}</span>
                  <span className="font-mono text-lg text-foreground">{card.value}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { title: "React Fundamentals", subject: "Frontend", progress: 100, color: "#7c6af7" },
                { title: "System Design", subject: "Architecture", progress: 65, color: "#4fb8f0" },
                { title: "Algorithms & DS", subject: "Computer Science", progress: 37, color: "#f07c4f" },
              ].map((board) => (
                <div key={board.title} className="bg-secondary border border-border rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full" style={{ background: board.color }} />
                  <div className="pt-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{board.subject}</p>
                    <p className="text-sm text-foreground mt-0.5">{board.title}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-card overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${board.progress}%`, background: board.color }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {board.progress === 100
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      : <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                    }
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {board.progress === 100 ? "All concepts learned" : `${board.progress}% complete`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* how it works */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-8 py-20 flex flex-col gap-12">
          <div className="text-center">
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-2">How it works</p>
            <h2 className="text-foreground">Four steps to mastery</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.08 }}
                className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
              >
                <span className="font-mono text-2xl text-primary/40">{step.step}</span>
                <h3 className="text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-8 py-20 flex flex-col gap-12">
          <div className="text-center">
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-2">Features</p>
            <h2 className="text-foreground">Everything you need to study smarter</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.07 }}
                className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${f.color}18`, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-8 py-24 flex flex-col items-center gap-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-foreground max-w-lg">Ready to start learning with intention?</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Build your first board in minutes. No setup, no fluff — just a clean space to study what matters.
            </p>
            <button onClick={() => navigate("/signup")}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create your account
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-3.5 h-3.5 text-primary" />
            Learning Logs
          </div>
          <span>Built for focused learners.</span>
        </div>
      </footer>
      </div>
    </GuestOnly>
  );
}
