import { useState, type FormEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Plus, Check, ChevronRight } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";
import { Toggle } from "../components/Toggle";
import { QUIZ_STYLE_OPTIONS, quizStyleLabel } from "../lib/quizStyles";
import { COLORS, SUBJECTS } from "../lib/boardOptions";
import type { DemoConcept, DemoPreset, DemoTag } from "./demoData";

/* ------------------------------------------------------------------------- */
/* Modal shell                                                               */
/* ------------------------------------------------------------------------- */

function ModalShell({
  open,
  title,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useScrollLock(open);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`relative w-full ${maxWidth} bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[90vh] flex flex-col`}
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-foreground">{title}</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function fieldLabel(text: string) {
  return (
    <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">{text}</label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
      style={{ fontFamily: "var(--font-sans)" }}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
      style={{ fontFamily: "var(--font-sans)" }}
    />
  );
}

/* ------------------------------------------------------------------------- */
/* New board                                                                 */
/* ------------------------------------------------------------------------- */

export function DemoNewBoardModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; subject: string; color: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !subject.trim()) return;
    onCreate({ title: title.trim(), subject: subject.trim(), color });
    setTitle("");
    setSubject("");
    setColor(COLORS[0]);
    onClose();
  }

  return (
    <ModalShell open={open} title="New board" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5 px-6 py-5 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Board title")}
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. React Fundamentals" />
        </div>
        <div className="flex flex-col gap-2">
          {fieldLabel("Subject")}
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono transition-all ${
                  subject === s
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {fieldLabel("Accent color")}
          <div className="flex items-center gap-2.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 shrink-0"
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : "none" }}
              >
                {color === c && <Check className="w-4 h-4 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={!title.trim() || !subject.trim()}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Create board
        </button>
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------------- */
/* Add concept                                                               */
/* ------------------------------------------------------------------------- */

export function DemoAddConceptModal({
  open,
  boardTags,
  onClose,
  onCreate,
}: {
  open: boolean;
  boardTags: DemoTag[];
  onClose: () => void;
  onCreate: (input: { title: string; answer: string; hint: string; learned: boolean; tagIds: string[] }) => void;
}) {
  const [title, setTitle] = useState("");
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState("");
  const [learned, setLearned] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);

  const query = tagInput.trim().toLowerCase();
  const matchingTags = query ? boardTags.filter((t) => t.name.toLowerCase().includes(query)) : boardTags;
  const selectedNames = new Set(boardTags.filter((t) => tagIds.includes(t.id)).map((t) => t.name));

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
    setTagInput("");
  }

  function handleTagKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && query) {
      e.preventDefault();
      // Create a temp tag on the fly is not supported for the demo's fixed
      // tag pool; instead select the first matching tag, or do nothing.
      const match = boardTags.find((t) => t.name.toLowerCase() === query) ?? matchingTags[0];
      if (match) toggleTag(match.id);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !answer.trim()) return;
    onCreate({
      title: title.trim(),
      answer: answer.trim(),
      hint: hint.trim() || "",
      learned,
      tagIds,
    });
    setTitle("");
    setAnswer("");
    setHint("");
    setLearned(false);
    setTagInput("");
    setTagIds([]);
    onClose();
  }

  return (
    <ModalShell open={open} title="Add concept" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5 px-6 py-5 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Title")}
          <TextInput autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Closures in JavaScript" />
        </div>
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Answer / explanation")}
          <TextArea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Explain the concept in your own words…" rows={3} />
        </div>
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Hint (optional)")}
          <TextInput value={hint} onChange={(e) => setHint(e.target.value)} placeholder="A small nudge to jog your memory…" />
        </div>

        {/* tags */}
        <div className="flex flex-col gap-2">
          {fieldLabel("Tags")}
          <div className="flex flex-wrap gap-1.5 min-h-10 px-3 py-2 rounded-lg bg-secondary border border-border">
            {tagIds.map((id) => {
              const tag = boardTags.find((t) => t.id === id);
              if (!tag) return null;
              return (
                <span key={id} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono">
                  {tag.name}
                  <button type="button" onClick={() => setTagIds((p) => p.filter((t) => t !== id))} className="hover:text-foreground">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder={tagIds.length === 0 ? "Search tags…" : ""}
              className="flex-1 min-w-30 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              style={{ fontFamily: "var(--font-sans)" }}
            />
            {tagInput && (
              <button type="button" onClick={() => setTagInput("")} aria-label="Clear tag search" className="shrink-0 self-center text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="tag-scrollbox h-18 overflow-y-auto rounded-lg border border-border bg-secondary/40 p-1.5 pr-1">
            {matchingTags.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground font-mono">
                {query ? `No tags match "${query}"` : "No tags on this board yet."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {matchingTags.map((tag) => {
                  const selected = tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-mono text-left transition-colors ${
                        selected
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-secondary text-muted-foreground border border-transparent hover:text-foreground hover:border-border"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-colors ${selected ? "bg-primary border-primary" : "border-border"}`}>
                        {selected && <Check className="w-2 h-2 text-white" />}
                      </span>
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">Selected: {selectedNames.size ? [...selectedNames].join(", ") : "none"}</p>
        </div>

        <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-secondary border border-border gap-4">
          <div>
            <p className="text-sm text-foreground">Mark as learned</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Start this concept as already learned</p>
          </div>
          <Toggle checked={learned} onChange={setLearned} />
        </div>

        <button
          type="submit"
          disabled={!title.trim() || !answer.trim()}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Add concept
        </button>
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------------- */
/* Add tag                                                                   */
/* ------------------------------------------------------------------------- */

export function DemoAddTagModal({
  open,
  existingNames,
  onClose,
  onCreate,
}: {
  open: boolean;
  existingNames: string[];
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    if (existingNames.includes(trimmed)) {
      setError("A tag with that name already exists.");
      return;
    }
    onCreate(trimmed);
    setName("");
    setError(null);
    onClose();
  }

  return (
    <ModalShell open={open} title="New tag" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5 px-6 py-5">
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Tag name")}
          <TextInput autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="e.g. recursion" />
        </div>
        {error && <p className="text-xs text-rose-500 font-mono">{error}</p>}
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Create tag
        </button>
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------------- */
/* New session setting                                                       */
/* ------------------------------------------------------------------------- */

const DEFAULT_STYLE: DemoPreset["style"] = "multiple_choice";

export function DemoNewSettingModal({
  open,
  boardTags,
  concepts,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  boardTags: DemoTag[];
  concepts: DemoConcept[];
  /** When provided, the modal edits this preset instead of creating one. */
  initial?: DemoPreset;
  onClose: () => void;
  onSave: (input: Omit<DemoPreset, "id" | "boardId">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [style, setStyle] = useState<DemoPreset["style"]>(initial?.style ?? DEFAULT_STYLE);
  const [includeKnown, setIncludeKnown] = useState(initial?.includeKnown ?? true);
  const [tagIds, setTagIds] = useState<string[] | null>(initial?.tagIds ?? null);
  const [matchAllTags, setMatchAllTags] = useState(initial?.matchAllTags ?? false);
  const [exactMatching, setExactMatching] = useState(initial?.exactMatching ?? false);

  const selectedNames = tagIds?.map((id) => boardTags.find((t) => t.id === id)?.name).filter((n): n is string => Boolean(n)) ?? [];

  function previewCount() {
    if (tagIds === null || selectedNames.length === 0) {
      return concepts.filter((c) => includeKnown || !c.learned).length;
    }
    return concepts.filter((c) => {
      if (!includeKnown && c.learned) return false;
      const conceptTags = new Set(boardTags.filter((t) => c.tagIds.includes(t.id)).map((t) => t.name));
      if (matchAllTags) return selectedNames.every((n) => conceptTags.has(n));
      return selectedNames.some((n) => conceptTags.has(n));
    }).length;
  }

  const count = previewCount();
  const mcDisabled = count < 4;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      style,
      includeKnown,
      tagIds,
      matchAllTags,
      exactMatching,
    });
    onClose();
  }

  return (
    <ModalShell open={open} title={initial ? "Edit setting" : "New setting"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5 px-6 py-5 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          {fieldLabel("Setting name")}
          <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quick review" />
        </div>

        <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-secondary border border-border gap-4">
          <div>
            <p className="text-sm text-foreground">Include learned concepts</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Show concepts you've already marked as learned</p>
          </div>
          <Toggle checked={includeKnown} onChange={setIncludeKnown} />
        </div>

        <div className="flex flex-col gap-2">
          {fieldLabel("Question type")}
          <div className="flex flex-col gap-1.5">
            {QUIZ_STYLE_OPTIONS.map((opt) => {
              const active = style === opt.id;
              const disabled = opt.id === "multiple_choice" && mcDisabled;
              return (
                <div key={opt.id} className={`relative ${disabled ? "group" : ""}`}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setStyle(opt.id)}
                    title={disabled ? "Needs at least 4 questions in the pool" : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full ${
                      active
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-secondary text-muted-foreground border border-transparent hover:text-foreground"
                    } ${disabled ? "disabled:opacity-40 disabled:cursor-not-allowed" : ""}`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                    {disabled && <span className="ml-auto text-[10px] font-mono text-muted-foreground/70">needs 4+</span>}
                  </button>
                  {disabled && (
                    <span className="absolute bottom-full mb-2 left-0 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground bg-card border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg shadow-black/40">
                      Needs at least 4 questions in the pool
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {style === "multiple_choice" && mcDisabled && (
            <p className="text-[11px] text-amber-400/90 font-mono">
              Multiple choice needs at least 4 questions in the pool (you have {count}) — pick another type.
            </p>
          )}
        </div>

        {style === "fill_in" && (
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-secondary border border-border gap-4">
            <div>
              <p className="text-sm text-foreground">Exact answer matching</p>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {exactMatching ? "Answers must match exactly (ignoring case & spacing)" : "Minor typos still count as correct"}
              </p>
            </div>
            <Toggle checked={exactMatching} onChange={setExactMatching} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            {fieldLabel("Tag filter")}
            <button
              type="button"
              onClick={() => setTagIds(tagIds === null ? [] : null)}
              className="text-[11px] text-primary hover:underline font-mono"
            >
              {tagIds === null ? "Filter by tags" : "Clear filter (all tags)"}
            </button>
          </div>
          {tagIds !== null ? (
            <>
              <div className="tag-scrollbox flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {boardTags.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground font-mono px-1">No tags on this board yet.</p>
                ) : (
                  boardTags.map((tag) => {
                    const active = tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setTagIds((prev) => (prev?.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...(prev ?? []), tag.id]))
                        }
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-secondary text-muted-foreground border border-transparent hover:text-foreground"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${active ? "bg-primary border-primary" : "border-border"}`}>
                          {active && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className="font-mono text-[12px]">{tag.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {(tagIds?.length ?? 0) > 0 && (
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-secondary border border-border gap-4">
                  <div>
                    <p className="text-sm text-foreground">Match all selected tags</p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {matchAllTags ? "Concepts must carry every selected tag" : "Concepts carrying any selected tag"}
                    </p>
                  </div>
                  <Toggle checked={matchAllTags} onChange={setMatchAllTags} />
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground font-mono px-1">All tags included in this session.</p>
          )}
        </div>

        <div className="px-4 py-3 rounded-xl bg-secondary border border-border">
          <p className="text-[11px] text-muted-foreground font-mono">
            This setting will include <span className="text-foreground">{count}</span> of {concepts.length} concept
            {concepts.length !== 1 ? "s" : ""}.
          </p>
        </div>

        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Check className="w-3.5 h-3.5" />
          Save setting
        </button>
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------------- */
/* Start session                                                             */
/* ------------------------------------------------------------------------- */

export function DemoStartSessionModal({
  open,
  presets,
  concepts,
  boardTags,
  onClose,
  onStart,
  onCreateSetting,
}: {
  open: boolean;
  presets: DemoPreset[];
  concepts: DemoConcept[];
  boardTags: DemoTag[];
  onClose: () => void;
  /** Fired with the chosen preset; the page simulates the run. */
  onStart: (preset: DemoPreset) => void;
  onCreateSetting: () => void;
}) {
  function previewCount(preset: DemoPreset) {
    const selectedNames = preset.tagIds?.map((id) => boardTags.find((t) => t.id === id)?.name).filter((n): n is string => Boolean(n)) ?? [];
    if (selectedNames.length === 0) {
      return concepts.filter((c) => preset.includeKnown || !c.learned).length;
    }
    return concepts.filter((c) => {
      if (!preset.includeKnown && c.learned) return false;
      const conceptTags = new Set(boardTags.filter((t) => c.tagIds.includes(t.id)).map((t) => t.name));
      if (preset.matchAllTags) return selectedNames.every((n) => conceptTags.has(n));
      return selectedNames.some((n) => conceptTags.has(n));
    }).length;
  }

  return (
    <ModalShell open={open} title="Start a session" onClose={onClose}>
      <div className="flex flex-col gap-2 px-6 py-4 overflow-y-auto">
        <p className="text-xs text-muted-foreground font-mono mb-2">
          Choose a saved setting — sessions are simulated in the demo.
        </p>
        {presets.length === 0 && (
          <p className="text-xs text-muted-foreground font-mono px-1 py-2">No saved settings yet.</p>
        )}
        {presets.map((preset) => {
          const count = previewCount(preset);
          return (
            <div key={preset.id} className="group flex items-center gap-3 bg-secondary rounded-xl px-4 py-3 hover:border-primary/30 border border-transparent transition-all">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { onClose(); onStart(preset); }}>
                <p className="text-sm text-foreground">{preset.name}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {quizStyleLabel(preset.style)} · {count} concept{count !== 1 ? "s" : ""} ·{" "}
                  {preset.includeKnown ? "includes learned" : "unknown only"} ·{" "}
                  {preset.tagIds === null
                    ? "all tags"
                    : `${preset.tagIds.length} tag${preset.tagIds.length !== 1 ? "s" : ""}`}
                  {preset.style === "fill_in" && preset.exactMatching ? " · exact match" : ""}
                </p>
              </div>
              <button
                onClick={() => { onClose(); onStart(preset); }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Start ${preset.name}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        <button
          onClick={onCreateSetting}
          className="flex items-center gap-2 mt-1 px-4 py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Create new setting
        </button>
      </div>
    </ModalShell>
  );
}
