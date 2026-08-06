import { useState, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { COLORS, SUBJECTS } from "../lib/boardOptions";

export function NewBoard() {
  const navigate = useNavigate();
  const { createBoard } = useBoard();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  const finalSubject = subject === "Other" ? customSubject : subject;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !finalSubject.trim()) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const board = await createBoard({
        title: title.trim(),
        subject: finalSubject.trim(),
        color: selectedColor,
      });
      navigate(`/app/board/${board.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto px-8 py-10 flex flex-col gap-8">
      <div>
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </button>
        <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">New board</p>
        <h1 className="text-foreground">Create a board</h1>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={handleSubmit}
        className="flex flex-col gap-6"
      >
        {/* title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Board title</label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. React Fundamentals"
            className="px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            style={{ fontFamily: "var(--font-sans)" }}
          />
        </div>

        {/* subject */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Subject</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono transition-all ${
                  subject === s
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {subject === "Other" && (
            <input
              autoFocus
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Enter subject name"
              className="px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all mt-1"
              style={{ fontFamily: "var(--font-sans)" }}
            />
          )}
        </div>

        {/* color */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Accent color</label>
          <div className="flex items-center gap-2.5 flex-wrap">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 shrink-0"
                style={{ background: color, boxShadow: selectedColor === color ? `0 0 0 2px var(--background), 0 0 0 4px ${color}` : "none" }}
              >
                {selectedColor === color && <Check className="w-4 h-4 text-white drop-shadow" />}
              </button>
            ))}

            {/* custom color picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => colorPickerRef.current?.click()}
                className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-colors overflow-hidden shrink-0"
                title="Custom color"
                style={!COLORS.includes(selectedColor) ? { background: selectedColor, border: `2px solid ${selectedColor}`, boxShadow: `0 0 0 2px var(--background), 0 0 0 4px ${selectedColor}` } : {}}
              >
                {COLORS.includes(selectedColor) ? (
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Check className="w-4 h-4 text-white drop-shadow" />
                )}
              </button>
              <input
                ref={colorPickerRef}
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                tabIndex={-1}
              />
            </div>
          </div>

          {/* preview card */}
          <div className="relative mt-2 bg-card border border-border rounded-xl p-5 overflow-hidden">
            <div
              className="absolute top-0 left-5 right-5 h-0.5 rounded-full"
              style={{ background: selectedColor }}
            />
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
              {finalSubject || "Subject"}
            </p>
            <p className="text-base text-foreground mt-0.5">{title || "Board title"}</p>
            <div className="flex items-center gap-1.5 mt-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">0 concepts</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">0 sessions</span>
            </div>
          </div>
        </div>

        {submitError && (
          <p className="text-xs text-rose-500 -mt-2" role="alert">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={!title.trim() || !finalSubject.trim() || isSubmitting}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating…" : "Create board"}
        </button>
      </motion.form>
    </main>
  );
}
