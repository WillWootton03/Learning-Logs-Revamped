import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { createTag } from "../lib/api/concepts";
import { useTags } from "../context/TagContext";
import { useScrollLock } from "../hooks/useScrollLock";

type Props = {
  boardId: string;
  open: boolean;
  onClose: () => void;
  /** Called after a tag is created so the page can refresh its list. */
  onCreated?: () => void;
};

/**
 * Modal for creating a single new tag on a board. Submits to the backend,
 * seeds the board's tag pool, then closes.
 */
export function TagModal({ boardId, open, onClose, onCreated }: Props) {
  useScrollLock(open);
  const { addTagToPool } = useTags();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function reset() {
    setName("");
    setSubmitError(null);
  }

  function handleClose() {
    if (isSubmitting) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await createTag(boardId, trimmed);
      addTagToPool(boardId, trimmed);
      onCreated?.();
      reset();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.form
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onSubmit={handleSubmit}
            className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl shadow-black/40 p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-foreground">New Tag</h2>
              <button type="button" onClick={handleClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground font-mono">Tag name</span>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. hooks"
                className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </label>

            {submitError && <p className="text-xs text-rose-400 font-mono">{submitError}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating…" : "Create tag"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
