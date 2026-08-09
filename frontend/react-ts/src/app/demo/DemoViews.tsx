import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft, BarChart2, BookOpen, CalendarDays, Check, CheckCircle2, ChevronRight, Circle,
  Clock, Eye, Flame, ListFilter, Pencil, Play, Plus, RotateCcw, Save, Search, SlidersHorizontal, Tag, Trash2, Type, Upload, X, XCircle,
} from "lucide-react";
import { ConfirmModal } from "../components/ConfirmModal";
import { quizStyleLabel } from "../lib/quizStyles";
import { COLORS, SUBJECTS } from "../lib/boardOptions";
import type { DemoStore } from "./useDemoStore";
import type { DemoBoard, DemoConcept, DemoPreset, DemoRun } from "./demoData";

type TagNameById = Map<string, string>;

/** "3m 24s" / "45s" from ms. */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm w-fit">
      <ArrowLeft className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Concepts list view — mirrors the real All Concepts page.
 * ══════════════════════════════════════════════════════════════════════════ */

type ConceptFilter = "all" | "learned" | "unlearned";

export function DemoConceptsView({
  board,
  concepts,
  tagNameById,
  store,
  onBack,
  onAddConcept,
  onOpenConcept,
  onToast,
}: {
  board: DemoBoard;
  concepts: DemoConcept[];
  tagNameById: TagNameById;
  store: DemoStore;
  onBack: () => void;
  onAddConcept: () => void;
  onOpenConcept: (conceptId: string) => void;
  onToast: (title: string, body: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConceptFilter>("all");
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);

  const allTagNames = useMemo(() => Array.from(new Set(concepts.flatMap((c) => c.tagIds))).map((id) => tagNameById.get(id)).filter((n): n is string => Boolean(n)).sort(), [concepts, tagNameById]);

  function toggleTag(tag: string) {
    setTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return concepts.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q) && !c.answer.toLowerCase().includes(q)) return false;
      if (filter === "learned" && !c.learned) return false;
      if (filter === "unlearned" && c.learned) return false;
      if (tagFilters.size > 0) {
        const names = new Set(c.tagIds.map((id) => tagNameById.get(id)).filter((n): n is string => Boolean(n)));
        for (const tag of tagFilters) {
          if (!names.has(tag)) return false;
        }
      }
      return true;
    });
  }, [concepts, search, filter, tagFilters, tagNameById]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Back label={board.title} onClick={onBack} />
        {/* Header row: title + primary actions */}
        <div className="flex md:flex-row flex-col items-start md:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
            <h1 className="text-foreground">All Concepts</h1>
          </div>
          <div className="flex items-center gap-2">
            {concepts.length > 0 && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-1 md:gap-3.5 px-1.5 md:px-3.5 py-2 rounded-lg border border-rose-500/25 text-sm text-rose-400 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete all
              </button>
            )}
            <div className="relative group">
              <button
                disabled
                className="flex items-center gap-1 px-1.5 md:px-3.5 md:gap-3.5 py-2 rounded-lg border border-border text-sm text-muted-foreground opacity-45 cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload CSV
              </button>
              <span className="absolute bottom-full mb-2 right-0 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground bg-card border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg shadow-black/40">
                CSV upload is disabled in the demo
              </span>
            </div>
            <button
              onClick={onAddConcept}
              className="flex items-center gap-1 px-1.5 md:px-3.5 py-2 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add concept
            </button>
          </div>
        </div>
      </div>

      {/* filters row */}
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
        <div className="relative w-full sm:w-72 sm:shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search concepts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-full transition-all"
          />
        </div>
      </div>

      <div className="flex gap-6">
        {/* tag sidebar */}
        {allTagNames.length > 0 && (
          <aside className="hidden lg:flex flex-col gap-1.5 w-44 shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Filter by tag</p>
            {allTagNames.map((tag) => (
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
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
              <p className="text-sm">{concepts.length === 0 ? "No concepts yet." : "No concepts match."}</p>
            </div>
          ) : (
            filtered.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
                onClick={() => onOpenConcept(c.id)}
                className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/30 transition-colors cursor-pointer"
              >
                {c.learned ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${c.learned ? "text-foreground" : "text-muted-foreground"}`}>{c.title}</p>
                  {c.tagIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.tagIds.map((id) => {
                        const name = tagNameById.get(id);
                        if (!name) return null;
                        return (
                          <button
                            key={id}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTag(name);
                            }}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono transition-colors ${
                              tagFilters.has(name) ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {c.lastReviewed && (
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden sm:block">{formatDate(c.lastReviewed)}</span>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Delete all concepts"
        description={`This permanently deletes all ${concepts.length} concepts on this board, along with their tags and quiz history. This cannot be undone.`}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          store.deleteAllConcepts(board.id);
          setDeleteOpen(false);
          onToast("Concepts deleted", `All ${concepts.length} concepts were removed.`);
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Concept detail view
 * ══════════════════════════════════════════════════════════════════════════ */

export function DemoConceptDetailView({
  board,
  concept,
  tagNameById,
  boardTags,
  store,
  onBack,
  onToast,
}: {
  board: DemoBoard;
  concept: DemoConcept;
  tagNameById: TagNameById;
  boardTags: { id: string; name: string }[];
  store: DemoStore;
  onBack: () => void;
  onToast: (title: string, body: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(concept.title);
  const [draftAnswer, setDraftAnswer] = useState(concept.answer);
  const [draftHint, setDraftHint] = useState(concept.hint ?? "");
  const [draftLearned, setDraftLearned] = useState(concept.learned);
  // Staged tag names for this concept (existing names + newly added ones).
  const [draftTags, setDraftTags] = useState<string[]>(concept.tagIds.map((id) => tagNameById.get(id) ?? id));
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  const query = tagInput.trim().toLowerCase();
  const stagedNames = draftTags.map((n) => n.toLowerCase());
  const matchingTags = boardTags.filter(
    (t) => !stagedNames.includes(t.name.toLowerCase()) && (query ? t.name.toLowerCase().includes(query) : true)
  );
  const canCreateTag = query.length > 0 && !stagedNames.includes(query) && !boardTags.some((t) => t.name.toLowerCase() === query);

  // Close the add-tag dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!addingTag) return;
    function onMouseDown(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setAddingTag(false);
        setTagInput("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [addingTag]);

  function startEdit() {
    setDraftTitle(concept.title);
    setDraftAnswer(concept.answer);
    setDraftHint(concept.hint ?? "");
    setDraftLearned(concept.learned);
    setDraftTags(concept.tagIds.map((id) => tagNameById.get(id) ?? id));
    setTagInput("");
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setAddingTag(false);
    setTagInput("");
  }

  /** Resolve staged tag names to ids, creating any that don't exist yet. */
  function resolveTagIds(names: string[]): string[] {
    const byName = new Map(boardTags.map((t) => [t.name.toLowerCase(), t.id]));
    const ids: string[] = [];
    for (const name of names) {
      const lower = name.toLowerCase();
      let id = byName.get(lower);
      if (!id) {
        const tag = store.createTag(board.id, lower);
        byName.set(lower, tag.id);
        id = tag.id;
      }
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  function save() {
    const title = draftTitle.trim();
    const answer = draftAnswer.trim();
    if (!title || !answer) return;
    store.updateConcept(board.id, concept.id, {
      title,
      answer,
      hint: draftHint.trim() === "" ? null : draftHint.trim(),
      learned: draftLearned,
      tagIds: resolveTagIds(draftTags),
    });
    cancelEdit();
    onToast("Concept updated", `"${title}" was saved.`);
  }

  function handleDelete() {
    store.deleteConcept(concept.id);
    onBack();
    onToast("Concept deleted", `"${concept.title}" was removed.`);
  }

  function addTag(name: string) {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed || stagedNames.includes(trimmed)) return;
    setDraftTags((prev) => [...prev, trimmed]);
    setTagInput("");
  }

  function handleNewTagKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = tagInput.trim().toLowerCase();
      if (!trimmed) return;
      const exact = boardTags.find((t) => t.name.toLowerCase() === trimmed);
      addTag(exact ? exact.name : trimmed);
    }
    if (e.key === "Escape") {
      setAddingTag(false);
      setTagInput("");
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <Back label="Concepts" onClick={onBack} />

      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono">{board.subject}</p>
            {isEditing ? (
              <input
                autoFocus
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Concept title"
                className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            ) : (
              <h1 className="text-foreground leading-snug">{concept.title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0 sm:mt-1">
            {!isEditing && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-mono border border-border hover:border-primary/40 px-2.5 py-1.5 rounded-lg"
                title="Edit concept"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            )}
            {!isEditing && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-rose-400 transition-colors text-xs font-mono border border-border hover:border-rose-500/40 px-2.5 py-1.5 rounded-lg"
                title="Delete concept"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            )}
            {isEditing ? (
              <button
                onClick={() => setDraftLearned((v) => !v)}
                className="shrink-0"
                title="Toggle learned"
              >
                {draftLearned ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono bg-emerald-400/10 px-3 py-1.5 rounded-full hover:bg-emerald-400/20 transition-colors">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Learned
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono bg-secondary px-3 py-1.5 rounded-full hover:bg-primary/15 hover:text-primary transition-colors">
                    <Circle className="w-3.5 h-3.5" />
                    Not learned
                  </span>
                )}
              </button>
            ) : (
              <span className="shrink-0">
                {concept.learned ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono bg-emerald-400/10 px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Learned
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono bg-secondary px-3 py-1.5 rounded-full">
                    <Circle className="w-3.5 h-3.5" />
                    Not learned
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* tags — editable only while editing the concept */}
        {isEditing ? (
          <div className="flex items-center gap-2 flex-wrap">
            {draftTags.map((name) => (
              <span key={name} className="group flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-mono border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-primary/10 transition-all" style={{ background: "rgba(139,111,245,0.06)" }}>
                {name}
                <button
                  onClick={() => setDraftTags((prev) => prev.filter((n) => n !== name))}
                  className="text-muted-foreground hover:text-rose-400 transition-colors"
                  title="Remove tag"
                  aria-label={`Remove tag ${name}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}

            {/* add tag — small dropdown with search */}
            <div ref={tagPickerRef} className="relative">
              <button
                onClick={() => setAddingTag((o) => !o)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
                title="Add tag"
              >
                <Plus className="w-3 h-3" />
                Add tag
              </button>

              {addingTag && (
                <div className="absolute top-full left-0 mt-2 w-72 z-20 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
                  {/* search */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleNewTagKeyDown}
                      placeholder="Search tags or type a new one…"
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    {tagInput && (
                      <button
                        type="button"
                        onClick={() => setTagInput("")}
                        aria-label="Clear tag search"
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* suggestions */}
                  <div className="tag-scrollbox max-h-44 overflow-y-auto p-1.5 flex flex-col gap-0.5">
                    {canCreateTag && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          addTag(query);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono text-left transition-colors bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        Create “{query}”
                      </button>
                    )}
                    {matchingTags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          addTag(t.name);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono text-left transition-colors bg-secondary text-muted-foreground hover:text-foreground hover:border-border"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        {t.name}
                      </button>
                    ))}
                    {!canCreateTag && matchingTags.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground font-mono">
                        No tags match “{query}”
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {concept.tagIds.length === 0 ? (
              <span className="text-xs text-muted-foreground font-mono">No tags</span>
            ) : (
              concept.tagIds.map((id) => {
                const name = tagNameById.get(id);
                if (!name) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded-full font-mono border border-border text-muted-foreground"
                    style={{ background: "rgba(139,111,245,0.06)" }}
                  >
                    {name}
                  </span>
                );
              })
            )}
          </div>
        )}

        {/* meta */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-mono flex-wrap">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {concept.lastReviewed ? `Last reviewed: ${formatDate(concept.lastReviewed)}` : "Never reviewed"}
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            {board.title}
          </span>
        </div>
      </motion.div>

      {/* divider */}
      <div className="h-px bg-border" />

      {/* answer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-foreground">Answer</h2>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          {isEditing ? (
            <textarea
              autoFocus
              value={draftAnswer}
              onChange={(e) => setDraftAnswer(e.target.value)}
              placeholder="Explain the concept in your own words…"
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-y"
            />
          ) : (
            <p className="text-foreground leading-relaxed text-sm">
              {concept.answer || <span className="text-muted-foreground italic">No answer added yet.</span>}
            </p>
          )}
        </div>
      </motion.div>

      {/* hint */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-muted-foreground/80 text-sm tracking-wide uppercase font-mono">Hint</h2>
        <div className="bg-secondary/30 border border-dashed border-border/60 rounded-xl p-4 sm:p-5">
          {isEditing ? (
            <textarea
              value={draftHint}
              onChange={(e) => setDraftHint(e.target.value)}
              placeholder="Add a hint to nudge yourself toward the answer…"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-transparent border border-dashed border-border/60 text-sm text-foreground/90 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all resize-y"
            />
          ) : (
            <p className="text-muted-foreground leading-relaxed text-sm">
              {concept.hint || <span className="text-muted-foreground/50 italic">No hint added yet.</span>}
            </p>
          )}
        </div>
      </motion.div>

      {/* actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex items-center gap-3"
      >
        {isEditing ? (
          <>
            <button
              onClick={cancelEdit}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save changes
            </button>
          </>
        ) : (
          <button
            onClick={() => onToast("Review again", "Solo review for a single concept isn't in the demo yet.")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Review again
          </button>
        )}
      </motion.div>

      <ConfirmModal
        open={deleteOpen}
        title="Delete concept?"
        description={`"${concept.title}" and its quiz history will be permanently removed from this board in the demo.`}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Tags view — mirrors the real All Tags page (card grid + progress).
 * ══════════════════════════════════════════════════════════════════════════ */

export function DemoTagsView({
  board,
  tags,
  concepts,
  tagNameById,
  store,
  onBack,
  onNewTag,
  onOpenConcept,
  onToast,
}: {
  board: DemoBoard;
  tags: { id: string; name: string }[];
  concepts: DemoConcept[];
  tagNameById: TagNameById;
  store: DemoStore;
  onBack: () => void;
  onNewTag: () => void;
  onOpenConcept: (conceptId: string) => void;
  onToast: (title: string, body: string) => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  // tag -> concepts on this board
  const tagMap = useMemo(() => {
    const map: Record<string, DemoConcept[]> = {};
    for (const tag of tags) map[tag.name] = [];
    for (const c of concepts) {
      for (const id of c.tagIds) {
        const name = tagNameById.get(id);
        if (!name) continue;
        if (!map[name]) map[name] = [];
        map[name].push(c);
      }
    }
    return map;
  }, [tags, concepts, tagNameById]);

  const sortedTags = useMemo(() => tags.map((t) => t.name).sort(), [tags]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Back label={board.title} onClick={onBack} />
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
            <h1 className="text-foreground">All Tags</h1>
          </div>
        </div>
        {/* action row — its own line beneath the header */}
        <div className="flex items-center gap-2">
          {tags.length > 0 && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-500/25 text-sm text-rose-400 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete all
            </button>
          )}
          <button
            onClick={onNewTag}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New tag
          </button>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
          <Tag className="w-7 h-7 opacity-30" />
          <p className="text-sm">No tags on this board yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTags.map((tag, i) => {
            const tagConcepts = tagMap[tag] ?? [];
            const learnedCount = tagConcepts.filter((c) => c.learned).length;
            const progress = tagConcepts.length > 0 ? Math.round((learnedCount / tagConcepts.length) * 100) : 0;
            return (
              <motion.div
                key={tag}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-foreground">#{tag}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">{learnedCount}/{tagConcepts.length}</span>
                </div>

                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${progress}%` }} />
                </div>

                <div className="tag-scrollbox flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {tagConcepts.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No concepts with this tag yet.</p>
                  ) : (
                    tagConcepts.map((concept) => (
                      <button
                        key={concept.id}
                        onClick={() => onOpenConcept(concept.id)}
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

      <ConfirmModal
        open={deleteOpen}
        title="Delete all tags"
        description={`This permanently deletes all ${tags.length} tags on this board and removes them from every concept. This cannot be undone.`}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          store.deleteAllTags(board.id);
          setDeleteOpen(false);
          onToast("Tags deleted", `All ${tags.length} tags were removed.`);
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Sessions view
 * ══════════════════════════════════════════════════════════════════════════ */

export function DemoSessionsView({
  board,
  runs,
  store,
  onBack,
  onOpenRun,
  onStartSession,
  onToast,
}: {
  board: DemoBoard;
  runs: DemoRun[];
  store: DemoStore;
  onBack: () => void;
  onOpenRun: (runId: string) => void;
  onStartSession: () => void;
  onToast: (title: string, body: string) => void;
}) {
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  const totalConcepts = runs.reduce((sum, r) => sum + r.conceptsStudied, 0);
  const avgPerSession = runs.length ? Math.round(totalConcepts / runs.length) : 0;
  const totalMinutes = runs.reduce((sum, r) => sum + Math.round(r.timeElapsedMs / 60_000), 0);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Back label={board.title} onClick={onBack} />
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
            <h1 className="text-foreground">Sessions</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {runs.length > 0 && (
            <button
              onClick={() => setDeleteAllOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-500/25 text-sm text-rose-400 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete all
            </button>
          )}
          <button
            onClick={onStartSession}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Start new session
          </button>
        </div>
      </div>

      {/* summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <SummaryCard icon={<BookOpen className="w-4 h-4" />} label="Total sessions" value={String(runs.length)} color="#7c6af7" />
        <SummaryCard icon={<BarChart2 className="w-4 h-4" />} label="Concepts studied" value={String(totalConcepts)} color="#4fb8f0" />
        <SummaryCard icon={<Clock className="w-4 h-4" />} label="Total time" value={`${totalMinutes} min`} color="#f07c4f" />
        <SummaryCard icon={<Flame className="w-4 h-4" />} label="Avg per session" value={String(avgPerSession)} color="#4ff0b8" />
      </motion.div>

      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
          <BookOpen className="w-7 h-7 opacity-30" />
          <p className="text-sm">No sessions recorded for this board yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.map((run, i) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.04 }}
              onClick={() => onOpenRun(run.id)}
              className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/30 transition-colors cursor-pointer group"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: board.color ?? "#7c6af7" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{run.presetName}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {run.conceptsStudied} concepts
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">{run.correctCount}</span>/{run.conceptsStudied} correct
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(run.timeElapsedMs)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] text-muted-foreground font-mono hidden sm:flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {formatDate(run.createdAt)}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteAllOpen}
        title="Delete all sessions"
        description={`This permanently deletes all ${runs.length} session records on this board in the demo. This cannot be undone.`}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={() => {
          store.deleteAllRuns(board.id);
          setDeleteAllOpen(false);
          onToast("Sessions deleted", `All ${runs.length} sessions were removed.`);
        }}
      />
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <span className="font-mono text-xl text-foreground">{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Session detail view
 * ══════════════════════════════════════════════════════════════════════════ */

export function DemoSessionDetailView({
  board,
  run,
  conceptById,
  tagNameById,
  onBack,
  onOpenConcept,
}: {
  board: DemoBoard;
  run: DemoRun;
  conceptById: Map<string, DemoConcept>;
  tagNameById: TagNameById;
  onBack: () => void;
  onOpenConcept: (conceptId: string) => void;
}) {
  const accuracy = run.conceptsStudied > 0 ? Math.round((run.correctCount / run.conceptsStudied) * 100) : 0;
  const accuracyColor = accuracy >= 80 ? "#4ff0b8" : accuracy >= 50 ? "#f0c94f" : "#f07c4f";
  const incorrectCount = run.conceptsStudied - run.correctCount;

  const allowedTagNames = useMemo(
    () => (run.tagIds ?? []).map((id) => tagNameById.get(id)).filter((n): n is string => Boolean(n)),
    [run.tagIds, tagNameById]
  );
  const dateLabel = formatDate(run.createdAt);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      {/* breadcrumb + back */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <button onClick={onBack} className="hover:text-foreground transition-colors">{board.title}</button>
          <span>/</span>
          <button onClick={onBack} className="hover:text-foreground transition-colors">Sessions</button>
          <span>/</span>
          <span className="text-foreground">{dateLabel}</span>
        </div>
        <Back label="Sessions" onClick={onBack} />
      </div>

      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-2"
      >
        <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono">{board.subject}</p>
        <h1 className="text-foreground">{run.presetName}</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-mono">
          <CalendarDays className="w-3.5 h-3.5" />
          {dateLabel}
        </p>
      </motion.div>

      {/* stat cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <StatCard label="Concepts" value={String(run.conceptsStudied)} icon={<BookOpen className="w-4 h-4" />} color={board.color ?? "#7c6af7"} />
        <StatCard label="Correct" value={String(run.correctCount)} icon={<CheckCircle2 className="w-4 h-4" />} color="#4ff0b8" />
        <StatCard label="Accuracy" value={`${accuracy}%`} icon={<BarChart2 className="w-4 h-4" />} color={accuracyColor} />
        <StatCard label="Duration" value={formatDuration(run.timeElapsedMs)} icon={<Clock className="w-4 h-4" />} color="#4fb8f0" />
      </motion.div>

      {/* session settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
      >
        <h2 className="text-foreground">Session settings</h2>
        <div className="flex flex-col gap-2">
          <SettingRow
            icon={<Eye className="w-3.5 h-3.5" />}
            label="Learned concepts"
            value={run.includeKnown ? "Included" : "Excluded"}
            active={run.includeKnown}
          />
          <SettingRow
            icon={<Tag className="w-3.5 h-3.5" />}
            label="Tag filter"
            value={
              run.tagIds === null
                ? "All tags"
                : run.tagIds.length === 0
                  ? "No tags selected"
                  : allowedTagNames.join(", ")
            }
            active={run.tagIds === null}
          />
          <SettingRow
            icon={<Type className="w-3.5 h-3.5" />}
            label="Exact answer matching"
            value={run.exactMatching ? "Exact" : "Lenient"}
            active={run.exactMatching}
          />
          <SettingRow
            icon={<ListFilter className="w-3.5 h-3.5" />}
            label="Match all selected tags"
            value={run.tagIds === null ? "Not applicable" : run.matchAllTags ? "On" : "Off"}
            active={run.tagIds !== null && run.matchAllTags}
          />
        </div>
      </motion.div>

      {/* accuracy bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Accuracy</span>
          <span className="font-mono text-sm" style={{ color: accuracyColor }}>
            {accuracy}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${accuracy}%` }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
            className="h-full rounded-full"
            style={{ background: accuracyColor }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground font-mono">
          {run.correctCount} correct · {incorrectCount} incorrect
        </p>
      </motion.div>

      {/* concept results */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-foreground">Concepts reviewed</h2>
        {run.results.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">No questions were recorded for this session.</p>
        ) : (
          run.results.map((row, i) => {
            const concept = conceptById.get(row.conceptId);
            return (
              <motion.div
                key={row.conceptId}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.15 + i * 0.04 }}
                onClick={() => concept && onOpenConcept(concept.id)}
                className={`flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 transition-colors group ${concept ? "cursor-pointer hover:border-primary/30" : ""}`}
              >
                {row.correct ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{concept?.title ?? "Deleted concept"}</p>
                  {concept && concept.tagIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {concept.tagIds.map((id) => {
                        const name = tagNameById.get(id);
                        if (!name) return null;
                        return <span key={id} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">{name}</span>;
                      })}
                    </div>
                  )}
                </div>
                <span className={`text-xs font-mono shrink-0 px-2.5 py-1 rounded-full ${row.correct ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>
                  {row.correct ? "Correct" : "Incorrect"}
                </span>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: ReactNode; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <span className="font-mono text-xl text-foreground">{value}</span>
    </div>
  );
}

function SettingRow({ icon, label, value, active }: { icon: ReactNode; label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-secondary">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-xs font-mono ${active ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Settings view — mirrors the real BoardSettings page: a "Board settings" tab
 * (name/subject/color/delete) and a "Session settings" tab (quiz presets).
 * ══════════════════════════════════════════════════════════════════════════ */

type SettingsTab = "board" | "sessions";

export function DemoSettingsView({
  board,
  presets,
  concepts,
  boardTags,
  store,
  onBack,
  onNewSetting,
  onEditSetting,
  onRun,
  onDeleted,
  onToast,
}: {
  board: DemoBoard;
  presets: DemoPreset[];
  concepts: DemoConcept[];
  boardTags: { id: string; name: string }[];
  store: DemoStore;
  onBack: () => void;
  onNewSetting: () => void;
  onEditSetting: (presetId: string) => void;
  onRun: (preset: DemoPreset) => void;
  onDeleted: () => void;
  onToast: (title: string, body: string) => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("board");
  const [deleteOpen, setDeleteOpen] = useState<DemoPreset | null>(null);

  function previewCount(preset: DemoPreset) {
    const selectedNames = (preset.tagIds ?? []).map((id) => boardTags.find((t) => t.id === id)?.name).filter((n): n is string => Boolean(n));
    if (selectedNames.length === 0) {
      return concepts.filter((c) => preset.includeKnown || !c.learned).length;
    }
    return concepts.filter((c) => {
      if (!preset.includeKnown && c.learned) return false;
      const conceptTags = new Set(c.tagIds.map((id) => boardTags.find((t) => t.id === id)?.name).filter((n): n is string => Boolean(n)));
      if (preset.matchAllTags) return selectedNames.every((n) => conceptTags.has(n));
      return selectedNames.some((n) => conceptTags.has(n));
    }).length;
  }

  const tabs: { key: SettingsTab; label: string; icon: ReactNode; count?: number }[] = [
    { key: "board", label: "Board settings", icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
    { key: "sessions", label: "Session settings", icon: <Play className="w-3.5 h-3.5" />, count: presets.length },
  ];

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Back label={board.title} onClick={onBack} />
        <div>
          <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">{board.subject}</p>
          <h1 className="text-foreground">Board settings</h1>
        </div>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setDeleteOpen(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count !== undefined && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* board settings tab */}
      {tab === "board" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
          <DemoBoardSettingsForm
            board={board}
            store={store}
            onDeleted={onDeleted}
            onToast={onToast}
          />
        </motion.div>
      )}

      {/* session settings tab */}
      {tab === "sessions" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{presets.length} setting{presets.length !== 1 ? "s" : ""}</p>
            <button
              onClick={onNewSetting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New setting
            </button>
          </div>

          {presets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
              <BookOpen className="w-7 h-7 opacity-30" />
              <p className="text-sm">No session settings yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {presets.map((preset) => {
                const count = previewCount(preset);
                return (
                  <div key={preset.id} className="group flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-all">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{preset.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {quizStyleLabel(preset.style)} · {count} concept{count !== 1 ? "s" : ""} ·{" "}
                        {preset.includeKnown ? "includes learned" : "unknown only"} ·{" "}
                        {preset.tagIds === null
                          ? "all tags"
                          : preset.matchAllTags && preset.tagIds.length > 0
                            ? `${preset.tagIds.length} tag${preset.tagIds.length !== 1 ? "s" : ""} (all)`
                            : `${preset.tagIds.length} tag${preset.tagIds.length !== 1 ? "s" : ""}`}
                        {preset.style === "fill_in" && preset.exactMatching ? " · exact match" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => onEditSetting(preset.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                        title="Edit setting"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteOpen(preset)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                        title="Delete setting"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => onRun(preset)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 text-xs font-mono hover:bg-primary/25 transition-colors shrink-0"
                    >
                      Run
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <ConfirmModal
            open={!!deleteOpen}
            title="Delete setting?"
            description={`"${deleteOpen?.name}" will be removed from this board in the demo.`}
            onClose={() => setDeleteOpen(null)}
            onConfirm={() => {
              if (deleteOpen) {
                store.deletePreset(deleteOpen.id);
                onToast("Setting deleted", `"${deleteOpen.name}" was removed.`);
              }
              setDeleteOpen(null);
            }}
          />
        </motion.div>
      )}
    </div>
  );
}

/**
 * Board settings editor: name, subject, color, and delete — mirroring the real
 * BoardSettingsForm. Saving writes only the changed fields to the demo store.
 */
function DemoBoardSettingsForm({
  board,
  store,
  onDeleted,
  onToast,
}: {
  board: DemoBoard;
  store: DemoStore;
  onDeleted: () => void;
  onToast: (title: string, body: string) => void;
}) {
  const [title, setTitle] = useState(board.title);
  const [subject, setSubject] = useState(SUBJECTS.includes(board.subject) ? board.subject : "Other");
  const [customSubject, setCustomSubject] = useState(SUBJECTS.includes(board.subject) ? "" : board.subject);
  const [color, setColor] = useState(board.color);
  const [masteryThreshold, setMasteryThreshold] = useState(board.masteryThreshold);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  const finalSubject = subject === "Other" ? customSubject : subject;

  function handleSave() {
    if (!title.trim() || !finalSubject.trim()) {
      setError("Name and subject are required.");
      return;
    }
    const changes: Partial<Omit<DemoBoard, "id">> = {};
    if (title.trim() !== board.title) changes.title = title.trim();
    if (finalSubject.trim() !== board.subject) changes.subject = finalSubject.trim();
    if (color !== board.color) changes.color = color;
    const threshold = Math.max(1, Math.floor(masteryThreshold || 0));
    if (threshold !== board.masteryThreshold) changes.masteryThreshold = threshold;

    if (Object.keys(changes).length === 0) {
      setSaveMessage("No changes to save.");
      setError(null);
      return;
    }
    setSaveMessage(null);
    setError(null);
    setIsSaving(true);
    store.updateBoard(board.id, changes);
    setIsSaving(false);
    setSaveMessage("Board settings saved.");
    onToast("Board settings saved", `"${changes.title ?? board.title}" was updated.`);
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    setIsDeleting(true);
    store.deleteBoard(board.id);
    setIsDeleting(false);
    onToast("Board deleted", `"${board.title}" was removed.`);
    onDeleted();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Board title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. React Fundamentals"
          className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        />
      </div>

      {/* subject */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Subject</label>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-mono transition-all ${
                subject === s
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {subject === "Other" && (
          <input
            type="text"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            placeholder="Enter subject name"
            className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all mt-1"
          />
        )}
      </div>

      {/* color */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Accent color</label>
        <div className="flex items-center gap-2.5 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 shrink-0"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : "none" }}
            >
              {color === c && <Check className="w-4 h-4 text-white drop-shadow" />}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => colorPickerRef.current?.click()}
              className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center hover:border-primary/50 transition-colors overflow-hidden shrink-0"
              title="Custom color"
              style={!COLORS.includes(color) ? { background: color, border: `2px solid ${color}`, boxShadow: `0 0 0 2px var(--background), 0 0 0 4px ${color}` } : {}}
            >
              {COLORS.includes(color) ? <Plus className="w-3.5 h-3.5 text-muted-foreground" /> : <Check className="w-4 h-4 text-white drop-shadow" />}
            </button>
            <input
              ref={colorPickerRef}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              tabIndex={-1}
            />
          </div>
        </div>
      </div>

      {/* mastery threshold */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">Mastery threshold</label>
        <p className="text-xs text-muted-foreground">
          Correct answers needed for a concept to count as learned.
        </p>
        <input
          type="number"
          min={1}
          value={masteryThreshold}
          onChange={(e) => setMasteryThreshold(Number(e.target.value))}
          className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all w-32 font-mono"
        />
      </div>

      {saveMessage && <p className="text-xs text-emerald-400">{saveMessage}</p>}
      {error && <p className="text-xs text-rose-400" role="alert">{error}</p>}

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Check className="w-3.5 h-3.5" />
        {isSaving ? "Saving…" : "Save changes"}
      </button>

      {/* delete board */}
      <div className="border-t border-border pt-6 mt-2 flex flex-col gap-2">
        {confirmDelete ? (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-xs text-rose-400">Delete "{board.title}"? This removes all its concepts, tags, settings, and sessions.</p>
            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Delete board"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="w-full py-2.5 rounded-lg border border-rose-500/30 text-rose-400 text-sm hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete board
          </button>
        )}
      </div>
    </div>
  );
}
