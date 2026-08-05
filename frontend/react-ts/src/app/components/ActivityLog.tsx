import { motion } from "motion/react";
import { BookOpen, CheckCircle2, Plus, Flame, Trophy, RotateCcw, Activity } from "lucide-react";
import type { ReactNode } from "react";

export type ActivityEntry = {
  id: string;
  type: "session" | "completed" | "new-board" | "streak" | "mastered" | "review";
  message: string;
  board: string;
  timestamp: string;
};

const iconMap: Record<ActivityEntry["type"], ReactNode> = {
  session: <BookOpen className="w-3.5 h-3.5" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5" />,
  "new-board": <Plus className="w-3.5 h-3.5" />,
  streak: <Flame className="w-3.5 h-3.5" />,
  mastered: <Trophy className="w-3.5 h-3.5" />,
  review: <RotateCcw className="w-3.5 h-3.5" />,
};

const colorMap: Record<ActivityEntry["type"], string> = {
  session: "text-[#8b6ff5] bg-[#8b6ff5]/10",
  completed: "text-emerald-400 bg-emerald-400/10",
  "new-board": "text-sky-400 bg-sky-400/10",
  streak: "text-amber-400 bg-amber-400/10",
  mastered: "text-yellow-300 bg-yellow-300/10",
  review: "text-rose-400 bg-rose-400/10",
};

/**
 * Recent study activity feed. Data-driven: entries come from the parent so no
 * demo data is shipped. Until sessions/logs are wired from the backend, the
 * dashboard passes an empty list and the empty state renders.
 */
export function ActivityLog({ entries = [] }: { entries?: ActivityEntry[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-foreground text-sm">Activity Log</h2>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Recent study activity</p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded-md">
          Last 7 days
        </span>
      </div>

      {entries.length > 0 ? (
        <div className="divide-y divide-border">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.25 + i * 0.04 }}
              className="flex items-center gap-4 px-5 py-3 hover:bg-secondary/40 transition-colors"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[entry.type]}`}>
                {iconMap[entry.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-none mb-1 truncate">{entry.message}</p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">{entry.board}</p>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0 hidden sm:block">
                {entry.timestamp}
              </span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-12 gap-3 text-center">
          <Activity className="w-7 h-7 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
          <p className="text-[11px] text-muted-foreground/70 font-mono">
            Complete a session to see it here
          </p>
        </div>
      )}
    </motion.div>
  );
}
