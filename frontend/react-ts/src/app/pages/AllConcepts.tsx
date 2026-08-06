import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Search, CheckCircle2, Circle } from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { useConcepts } from "../context/ConceptContext";

type Filter = "all" | "learned" | "unlearned";

export function AllConcepts() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { boards, isBoardsLoading } = useBoard();
  const { concepts, loadConcepts } = useConcepts();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  // Tracks the board whose concepts have finished loading; while it doesn't
  // match the current route the page shows a spinner. Using derived state
  // (rather than resetting flags in the effect) keeps all writes in callbacks.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const board = boards.find((b) => b.id === id);
  const all = id ? concepts[id] ?? [] : [];
  const isLoading = loadedFor !== id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadConcepts(id)
      .then(() => {
        if (!cancelled) {
          setLoadedFor(id);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load concepts");
          setLoadedFor(id);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, loadConcepts]);

  if (isBoardsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <p className="text-sm">Board not found.</p>
        <button onClick={() => navigate("/app")} className="text-primary text-sm hover:underline">
          Back to dashboard
        </button>
      </div>
    );
  }

  const allTags = Array.from(new Set(all.flatMap((c) => c.tags))).sort();

  /** Toggle a tag in/out of the active tag filter set. */
  function toggleTag(tag: string) {
    setTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const filtered = all.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "learned" && !c.learned) return false;
    if (filter === "unlearned" && c.learned) return false;
    // A concept must have every selected tag to match.
    for (const tag of tagFilters) {
      if (!c.tags.includes(tag)) return false;
    }
    return true;
  });

  return (
    <main className="max-w-7xl mx-auto px-8 py-10 flex flex-col gap-8">
      <div>
        <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
        <h1 className="text-foreground">All Concepts</h1>
      </div>

      {/* filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {(["all", "learned", "unlearned"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs capitalize transition-all ${
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {[...tagFilters].sort().map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-mono border border-primary/30 hover:bg-primary/25 transition-colors"
            >
              #{tag} ×
            </button>
          ))}
        </div>
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search concepts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-52 transition-all"
          />
        </div>
      </div>

      <div className="flex gap-6">
        {/* tag sidebar */}
        {allTags.length > 0 && (
          <aside className="hidden lg:flex flex-col gap-1.5 w-44 flex-shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Filter by tag</p>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  tagFilters.has(tag)
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {tag}
              </button>
            ))}
          </aside>
        )}

        {/* concept list */}
        <div className="flex-1 flex flex-col gap-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
              <p className="text-sm">{loadError}</p>
              <button
                onClick={() => {
                  setLoadError(null);
                  setLoadedFor(null);
                  loadConcepts(id!);
                }}
                className="text-primary text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
              <p className="text-sm">No concepts match.</p>
            </div>
          ) : (
            filtered.map((concept, i) => (
              <motion.div
                key={concept.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                onClick={() => navigate(`/app/board/${id}/concept/${concept.id}`)}
                className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/30 transition-colors cursor-pointer"
              >
                {concept.learned ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${concept.learned ? "text-foreground" : "text-muted-foreground"}`}>{concept.title}</p>
                  {concept.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {concept.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTag(tag);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono transition-colors ${
                            tagFilters.has(tag)
                              ? "bg-primary/20 text-primary"
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {concept.lastReviewed && (
                  <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0 hidden sm:block">{concept.lastReviewed}</span>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
