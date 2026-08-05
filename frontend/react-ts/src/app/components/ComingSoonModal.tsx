import { AnimatePresence, motion } from "motion/react";
import { X, Construction } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
};

/**
 * Modal shell for features that aren't wired to the backend yet (e.g. quiz
 * sessions, CSV import). Keeps the board page's controls present and honest
 * until those flows land.
 */
export function ComingSoonModal({ open, onClose, title, description }: Props) {
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
            className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 p-6 flex flex-col items-center text-center gap-3"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Construction className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            <p className="text-xs text-muted-foreground font-mono">Coming soon</p>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors mt-1"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
