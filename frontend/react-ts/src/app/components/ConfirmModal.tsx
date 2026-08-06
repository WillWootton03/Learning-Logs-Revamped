import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Disables the confirm button while an action is in flight. */
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Reusable destructive-action confirmation dialog (e.g. "delete all").
 * Consistent overlay/panel styling with the other modals in the app; the
 * confirm button is always the danger color.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Delete",
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  useScrollLock(open);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={busy ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl shadow-black/50"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <h2 className="text-foreground">{title}</h2>
              </div>
              <button
                onClick={onClose}
                disabled={busy}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-rose-500/90 text-white text-sm hover:bg-rose-500 transition-colors disabled:opacity-40"
              >
                {busy ? "Deleting…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
