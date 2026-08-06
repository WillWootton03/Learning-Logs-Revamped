import { useState, type FormEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Plus, Check } from "lucide-react";
import { useConcepts } from "../context/ConceptContext";
import { useTags } from "../context/TagContext";
import { useScrollLock } from "../hooks/useScrollLock";

type Props = {
  boardId: string;
  open: boolean;
  onClose: () => void;
};

/**
 * Modal for adding a concept to a board. Submits to the backend (creating
 * the concept and linking any tags), then the parent's createConcept refreshes
 * state so the new concept appears immediately.
 */
export function AddConceptModal({ boardId, open, onClose }: Props) {
  useScrollLock(open);
  const { createConcept } = useConcepts();
  const { boardTagPool } = useTags();
  const [title, setTitle] = useState("");
  const [answer, setAnswer] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const boardTags = boardTagPool[boardId] ?? [];
  // The tag bar doubles as a search field: typing filters the board's tags,
  // and Enter (or the "create" row) adds whatever is typed as a temporary tag.
  // Temporary tags only reach the DB when the concept is submitted.
  const query = tagInput.trim().toLowerCase();
  const matchingTags = query ? boardTags.filter((t) => t.includes(query)) : boardTags;
  const canCreateTag = query.length > 0 && !boardTags.some((t) => t === query) && !tags.includes(query);

  function addTag(t: string) {
    const trimmed = t.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) setTags((prev) => [...prev, trimmed]);
  }

  /** Toggle a board tag on/off and clear the search text. */
  function selectTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setTagInput("");
  }

  /** Add whatever is typed as a brand-new temporary tag. */
  function createTagFromQuery() {
    addTag(query);
    setTagInput("");
  }

  function handleTagKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(query);
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput && tags.length) setTags((prev) => prev.slice(0, -1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !answer.trim()) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await createConcept(boardId, {
        prompt: title.trim(),
        answer: answer.trim(),
        tags,
      });
      reset();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setTitle("");
    setAnswer("");
    setTags([]);
    setTagInput("");
    setSubmitError(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={reset}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[90vh] flex flex-col"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-foreground">Add concept</h2>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5 overflow-y-auto">
              {/* title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Title</label>
                <input
                  autoFocus
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Closures in JavaScript"
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                  style={{ fontFamily: "var(--font-sans)" }}
                />
              </div>

              {/* answer */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Answer / explanation</label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Explain the concept in your own words…"
                  rows={3}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
                  style={{ fontFamily: "var(--font-sans)" }}
                />
              </div>

              {/* tags */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Tags</label>

                {/* selected tags + input */}
                <div className="flex flex-wrap gap-1.5 min-h-10 px-3 py-2 rounded-lg bg-secondary border border-border focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  {tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono">
                      {tag}
                      <button type="button" onClick={() => setTags((p) => p.filter((t) => t !== tag))} className="hover:text-foreground">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder={tags.length === 0 ? "Search tags or type a new one…" : ""}
                    className="flex-1 min-w-30 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    style={{ fontFamily: "var(--font-sans)" }}
                  />
                  {tagInput && (
                    <button
                      type="button"
                      onClick={() => setTagInput("")}
                      aria-label="Clear tag search"
                      className="shrink-0 self-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* all board tags — always visible, ~2 rows of a wrapping
                    flex where column count adapts to item width. Filtering
                    only kicks in once the user types. */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                    {query ? "Matching tags" : "Tags from this board"}
                  </p>
                  <div className="tag-scrollbox h-18 overflow-y-auto rounded-lg border border-border bg-secondary/40 p-1.5 pr-1">
                    {canCreateTag && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={createTagFromQuery}
                        className="w-full mb-1.5 flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-mono text-left transition-colors bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        Create “{query}”
                      </button>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {matchingTags.map((tag) => {
                        const selected = tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectTag(tag)}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-mono text-left transition-colors ${
                              selected
                                ? "bg-primary/15 text-primary border border-primary/30"
                                : "bg-secondary text-muted-foreground border border-transparent hover:text-foreground hover:border-border"
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-colors ${selected ? "bg-primary border-primary" : "border-border"}`}>
                              {selected && <Check className="w-2 h-2 text-white" />}
                            </span>
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    {query && matchingTags.length === 0 && !canCreateTag && (
                      <p className="px-3 py-2 text-xs text-muted-foreground font-mono">No tags match “{query}”</p>
                    )}
                  </div>
                </div>
              </div>

              {submitError && (
                <p className="text-xs text-rose-500" role="alert">
                  {submitError}
                </p>
              )}

              {/* actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !answer.trim() || isSubmitting}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isSubmitting ? "Adding…" : "Add concept"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
