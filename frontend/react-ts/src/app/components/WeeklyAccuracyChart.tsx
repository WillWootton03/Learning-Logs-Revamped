import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { ArrowRight, BarChart2, Minus, TrendingDown, TrendingUp } from "lucide-react";

/**
 * Board-scoped accuracy chart. Mirrors the landing page's bar graph: one bar
 * per day for the last 7 days, animated up on mount, with today's bar
 * highlighted. Multiple sessions on the same day are folded into one bar
 * (weighted accuracy, not a plain average), so a 10-question session weighs
 * more than a 2-question one.
 */

export type AccuracyRun = {
  correctCount: number;
  conceptsStudied: number;
  createdAt: string;
};

type Bar = {
  key: string;
  label: string;
  accuracy: number;
  sessions: number;
  hasData: boolean;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildWeek(runs: AccuracyRun[]): Bar[] {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
    return { key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: "short" }) };
  });

  const byDay = new Map<string, { correct: number; studied: number; sessions: number }>();
  for (const run of runs) {
    const d = new Date(run.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(startOfDay(d));
    const agg = byDay.get(key) ?? { correct: 0, studied: 0, sessions: 0 };
    agg.correct += run.correctCount;
    agg.studied += run.conceptsStudied;
    agg.sessions += 1;
    byDay.set(key, agg);
  }

  return days.map((day) => {
    const agg = byDay.get(day.key);
    const studied = agg?.studied ?? 0;
    const accuracy = studied > 0 && agg ? Math.round((agg.correct / studied) * 100) : 0;
    return {
      ...day,
      accuracy,
      sessions: agg?.sessions ?? 0,
      hasData: studied > 0,
    };
  });
}

/** Weighted accuracy over a day range, or null when no sessions fell in it. */
function rangeAccuracy(runs: AccuracyRun[], daysBackStart: number, daysBackEnd: number): number | null {
  const today = startOfDay(new Date());
  let correct = 0;
  let studied = 0;
  for (const run of runs) {
    const d = new Date(run.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
    if (diff >= -daysBackEnd && diff <= -daysBackStart) {
      correct += run.correctCount;
      studied += run.conceptsStudied;
    }
  }
  return studied > 0 ? Math.round((correct / studied) * 100) : null;
}

export function WeeklyAccuracyChart({
  boardId,
  runs,
  isLoading = false,
}: {
  boardId: string;
  runs: AccuracyRun[];
  isLoading?: boolean;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<number | null>(null);

  const bars = useMemo(() => buildWeek(runs), [runs]);

  const weekSessions = bars.reduce((sum, b) => sum + b.sessions, 0);
  const weekAccuracy = useMemo(() => rangeAccuracy(runs, 0, 6) ?? 0, [runs]);
  const prevAccuracy = useMemo(() => rangeAccuracy(runs, 7, 13), [runs]);
  const delta = weekSessions > 0 && prevAccuracy !== null ? weekAccuracy - prevAccuracy : null;

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-28 bg-secondary animate-pulse rounded-sm" />
            <div className="h-2.5 w-44 bg-secondary animate-pulse rounded-sm" />
          </div>
          <div className="h-6 w-20 bg-secondary animate-pulse rounded-lg" />
        </div>
        <div className="flex items-end gap-2 h-40">
          {[30, 48, 36, 62, 44, 58, 72].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full rounded-t-md bg-secondary animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
              <div className="h-2.5 w-8 bg-secondary animate-pulse rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-foreground">Weekly accuracy</p>
        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Correct answers · last 7 days</p>
      </div>
      <div className="flex items-center gap-3">
        {weekSessions > 0 && (
          <span
            className={`font-mono text-sm ${
              weekAccuracy >= 80
                ? "text-emerald-400"
                : weekAccuracy >= 60
                  ? "text-amber-400"
                  : "text-rose-400"
            }`}
          >
            {weekAccuracy}% avg
          </span>
        )}
        <button
          type="button"
          onClick={() => navigate(`/app/board/${boardId}/sessions`)}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          View sessions
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  if (weekSessions === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        {header}
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
          <BarChart2 className="w-7 h-7 opacity-30" />
          <p className="text-sm">No sessions this week yet.</p>
          <p className="text-[11px] font-mono">Run a session and your accuracy will show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      {header}

      <div className="flex items-end gap-2 h-40 pt-5">
        {bars.map((bar, i) => (
          <div
            key={bar.key}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="relative flex-1 h-full flex flex-col items-center justify-end gap-2"
          >
            {hovered === i && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-mono text-foreground shadow-lg shadow-black/20 whitespace-nowrap">
                {bar.hasData ? (
                  <>
                    {bar.accuracy}% correct · {bar.sessions} session{bar.sessions === 1 ? "" : "s"}
                  </>
                ) : (
                  "No sessions"
                )}
              </div>
            )}
            <div className="w-full flex-1 flex items-end justify-center min-h-0">
              <motion.div
                className="w-full h-full rounded-t-md origin-bottom transition-colors duration-200"
                style={{
                  background: bar.hasData
                    ? hovered === i
                      ? "color-mix(in srgb, var(--primary) 80%, transparent)"
                      : "color-mix(in srgb, var(--primary) 30%, transparent)"
                    : "color-mix(in srgb, var(--primary) 8%, transparent)",
                  opacity: bar.hasData ? 1 : 0.45,
                  boxShadow:
                    i === bars.length - 1 && bar.hasData
                      ? "0 0 24px color-mix(in srgb, var(--primary) 40%, transparent)"
                      : hovered === i
                        ? "0 0 18px color-mix(in srgb, var(--primary) 25%, transparent)"
                        : undefined,
                }}
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: bar.hasData ? Math.max(bar.accuracy / 100, 0.05) : 0.02 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{bar.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {weekSessions} session{weekSessions === 1 ? "" : "s"} this week
        </span>
        {delta !== null && delta !== 0 ? (
          <span className={`flex items-center gap-1.5 ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {delta > 0 ? "Up" : "Down"} {Math.abs(delta)}% vs last week
          </span>
        ) : delta === 0 ? (
          <span className="flex items-center gap-1.5">
            <Minus className="w-3.5 h-3.5" />
            Steady vs last week
          </span>
        ) : (
          <span className="font-mono">first week tracked</span>
        )}
      </div>
    </div>
  );
}
