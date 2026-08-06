import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Save, Trash2, X } from "lucide-react";
import { useLogs } from "../context/LogContext";
import { useScrollLock } from "../hooks/useScrollLock";
import type { Log } from "../types";

type Props = {
  boardId: string;
  /** The log being edited, or null/undefined for a new log. */
  log?: Log | null;
  open: boolean;
  onClose: () => void;
};

/**
 * Modal for creating or editing a board log. Submits to the backend via
 * LogContext (create or update), and offers delete while editing.
 */
export function LogModal({ boardId, log, open, onClose }: Props) {
  useScrollLock(open);
  const { createLog, updateLog, deleteLog } = useLogs();
  // The parent remounts this modal (via `key`) every time it opens, so lazy
  // initialization from `log` is enough to seed title/body for editing.
  const [title, setTitle] = useState(log?.title ?? "");
  const [body, setBody] = useState(log?.body ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditing = !!log;

  function reset() {
    setTitle("");
    setBody("");
    setSubmitError(null);
  }

  function handleClose() {
    if (isSubmitting) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateLog(boardId, log!.id, { title: trimmed, body: body.trim() });
      } else {
        await createLog(boardId, { title: trimmed, body: body.trim() });
      }
      reset();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!isEditing || isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await deleteLog(boardId, log!.id);
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
            className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-foreground">{isEditing ? "Edit log" : "New log"}</h2>
              <div className="flex items-center gap-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    title="Delete log"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 px-6 py-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Title</span>
                <input
                  autoFocus
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What did you learn or realise?"
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Notes</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your thoughts, insights, or reminders…"
                  rows={6}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
                />
              </label>

              {submitError && <p className="text-xs text-rose-400 font-mono">{submitError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSubmitting ? "Saving…" : isEditing ? "Save changes" : "Add log"}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
