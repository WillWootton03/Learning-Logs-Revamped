import { motion } from "motion/react";
import { BookOpen, CheckCircle2, Plus, Flame, Trophy, RotateCcw, ChevronRight, Activity } from "lucide-react";
import type { ReactNode } from "react";

export type ActivityEntry = {
  id: string;
  /** The board the activity happened on — used to link to its session detail. */
  boardId: string;
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
 * demo data is shipped. The list caps at 4 visible rows and scrolls past that,
 * so a long history never stretches the page. When `onSelect` is provided each
 * row is a button that surfaces a chevron on hover. While `isLoading` is true
 * a skeleton of the row layout is shown in place of the real feed.
 */
export function ActivityLog({
  entries = [],
  title = "Activity Log",
  subtitle = "Recent study activity",
  badge = "Last 7 days",
  onSelect,
  isLoading = false,
}: {
  entries?: ActivityEntry[];
  title?: string;
  subtitle?: string;
  badge?: string;
  /** When set, each row becomes clickable and is invoked with the entry. */
  onSelect?: (entry: ActivityEntry) => void;
  /** Shows skeleton rows while the feed is being fetched. */
  isLoading?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-foreground text-sm">{title}</h2>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{subtitle}</p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-1 rounded-md">
          {badge}
        </span>
      </div>

      {isLoading ? (
        <div className="divide-y divide-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3" aria-hidden="true">
              <div className="w-7 h-7 rounded-lg bg-secondary animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="h-3 w-2/3 bg-secondary animate-pulse rounded-sm" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="h-2.5 w-1/3 bg-secondary animate-pulse rounded-sm" style={{ animationDelay: `${i * 80}ms` }} />
              </div>
              <div className="h-2.5 w-10 bg-secondary animate-pulse rounded-sm shrink-0 hidden sm:block" style={{ animationDelay: `${i * 80}ms` }} />
            </div>
          ))}
        </div>
      ) : entries.length > 0 ? (
        <div className="divide-y divide-border max-h-58 overflow-y-auto">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.25 + i * 0.04 }}
              onClick={onSelect ? () => onSelect(entry) : undefined}
              className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                onSelect ? "cursor-pointer hover:bg-secondary/40 group" : ""
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorMap[entry.type]}`}>
                {iconMap[entry.type]}
              </div>
              <div className="flex-1 min-w-0">
                {/* leading-none clips descenders (g/y/p) on taller fonts —
                    leading-snug keeps the row tight without cutting them off. */}
                <p className="text-sm text-foreground leading-snug mb-1 truncate">{entry.message}</p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">{entry.board}</p>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden sm:block">
                {entry.timestamp}
              </span>
              {onSelect && (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
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
