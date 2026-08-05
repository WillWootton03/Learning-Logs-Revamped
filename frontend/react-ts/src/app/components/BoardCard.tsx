import { motion } from "motion/react";
import { BookOpen, Flame, CalendarDays, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Board } from "../types";

type Props = {
  board: Board;
  index: number;
  onClick?: () => void;
};

export function BoardCard({ board, index, onClick }: Props) {
  const allLearned = board.conceptCount > 0 && board.conceptsLearned === board.conceptCount;
  const progress = board.conceptCount === 0 ? 0 : Math.round((board.conceptsLearned / board.conceptCount) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
      onClick={onClick}
      className="group relative bg-card border border-border rounded-xl p-5 flex flex-col gap-4 cursor-pointer hover:border-[rgba(124,106,247,0.35)] hover:bg-[#14162080] transition-all duration-200"
    >
      {/* top accent line */}
      <div
        className="absolute top-0 left-5 right-5 h-[2px] rounded-full opacity-70"
        style={{ background: board.color }}
      />

      {/* header */}
      <div className="flex items-start justify-between pt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">
            {board.subject}
          </span>
          <h3 className="text-base text-foreground leading-snug">{board.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-muted-foreground">Open</span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-mono">
            {board.conceptsLearned}/{board.conceptCount} concepts
          </span>
          <span className="text-[11px] font-mono" style={{ color: board.color }}>
            {progress}%
          </span>
        </div>
        <div className="h-[3px] rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: board.color }}
          />
        </div>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <Stat icon={<BookOpen className="w-3 h-3" />} label="sessions" value={board.sessionCount} />
        <Stat
          icon={<Flame className="w-3 h-3" />}
          label="streak"
          value={`${board.streakDays}d`}
          highlight={board.streakDays >= 7}
        />
        <Stat icon={<CalendarDays className="w-3 h-3" />} label="last used" value={board.lastUsed} small />
      </div>

      {/* completion badge */}
      <div className="flex items-center gap-1.5 border-t border-border pt-3 mt-auto">
        {allLearned ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <span
          className={`text-[11px] font-mono ${
            allLearned ? "text-emerald-400" : "text-muted-foreground"
          }`}
        >
          {allLearned ? "All concepts learned" : `${board.conceptCount - board.conceptsLearned} remaining`}
        </span>
      </div>
    </motion.div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
  small,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 bg-secondary rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span
        className={`font-mono ${small ? "text-[11px]" : "text-sm"} ${
          highlight ? "text-amber-400" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
