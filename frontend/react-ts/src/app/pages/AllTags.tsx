import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { CheckCircle2, Circle, Plus, Tag } from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { useConcepts } from "../context/ConceptContext";
import { listTags } from "../lib/api";
import { TagModal } from "../components/TagModal";

export function AllTags() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { boards, isBoardsLoading } = useBoard();
  const { concepts, loadConcepts } = useConcepts();
  const [boardTags, setBoardTags] = useState<{ tag_id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Tracks the board whose data has finished loading; while it doesn't match
  // the current route the page shows a spinner. Using derived state (rather
  // than resetting flags in the effect) keeps all writes in callbacks.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const board = boards.find((b) => b.id === id);
  const all = id ? concepts[id] ?? [] : [];
  const isLoading = loadedFor !== id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        await loadConcepts(id);
        const boardTagRows = await listTags(id);
        if (!cancelled) {
          setBoardTags(boardTagRows);
          setLoadedFor(id);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load board");
          setLoadedFor(id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadConcepts]);

  /** Refresh both sources the page derives its tags from. */
  async function reload() {
    if (!id) return;
    await loadConcepts(id);
    setBoardTags(await listTags(id));
  }

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

  // Build tag → concepts map. Seed it from the board's own tag table so tags
  // with no concepts (e.g. freshly created ones) still show up as cards.
  const tagMap: Record<string, typeof all> = {};
  for (const tag of boardTags) tagMap[tag.name] = [];
  for (const concept of all) {
    for (const tag of concept.tags) {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push(concept);
    }
  }
  const tags = Object.keys(tagMap).sort();

  return (
    <main className="max-w-7xl mx-auto px-8 py-10 flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
          <h1 className="text-foreground">All Tags</h1>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New tag
        </button>
      </div>

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
              reload();
            }}
            className="text-primary text-sm hover:underline"
          >
            Try again
          </button>
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
          <Tag className="w-7 h-7 opacity-30" />
          <p className="text-sm">No tags on this board yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag, i) => {
            const tagConcepts = tagMap[tag];
            const learnedCount = tagConcepts.filter((c) => c.learned).length;
            const progress =
              tagConcepts.length > 0 ? Math.round((learnedCount / tagConcepts.length) * 100) : 0;
            return (
              <motion.div
                key={tag}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-foreground">#{tag}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">{learnedCount}/{tagConcepts.length}</span>
                </div>

                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${progress}%` }} />
                </div>

                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {tagConcepts.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No concepts with this tag yet.</p>
                  ) : (
                    tagConcepts.map((concept) => (
                      <button
                        key={concept.id}
                        onClick={() => navigate(`/app/board/${id}/concept/${concept.id}`)}
                        className="flex items-center gap-2 text-left hover:bg-secondary rounded-lg px-2 py-1.5 transition-colors group"
                      >
                        {concept.learned ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={`text-xs truncate ${concept.learned ? "text-foreground" : "text-muted-foreground"}`}>
                          {concept.title}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <TagModal
        boardId={id!}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={reload}
      />
    </main>
  );
}
