import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  CalendarDays,
  BookOpen,
  Plus,
  X,
  Check,
  Pencil,
  RotateCcw,
  Search,
  Save,
} from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { useConcepts } from "../context/ConceptContext";
import {
  getConcept,
  listConceptTags,
  listTags,
  createTags,
  linkTags,
  unlinkTag,
  updateTag,
} from "../lib/api";
import { ComingSoonModal } from "../components/ComingSoonModal";

type TagMeta = { tag_id: string; name: string };

/** Short, readable date for the "Last reviewed" line. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ConceptDetail() {
  const { id, conceptId } = useParams<{ id: string; conceptId: string }>();
  const navigate = useNavigate();
  const { boards, isBoardsLoading } = useBoard();
  const { concepts, loadConcepts, setConceptLearned, updateConcept } = useConcepts();

  // Tags with ids — the backend works with tag ids for rename/unlink, but the
  // concept list only carries names, so the page fetches the id map on load.
  const [tagMeta, setTagMeta] = useState<TagMeta[]>([]);
  // Every tag on the board (id + name) — powers the add-tag dropdown search.
  const [boardTags, setBoardTags] = useState<TagMeta[]>([]);
  const [lastReviewed, setLastReviewed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Concept editing state — edits are staged locally and only pushed to the
  // backend as one package on Save. Cancelling (or saving an unchanged
  // concept) never hits the API.
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [draftLearned, setDraftLearned] = useState(false);
  // Staged tag names for this concept after add/remove/rename operations.
  const [draftTags, setDraftTags] = useState<string[]>([]);
  // Board-wide tag renames staged while editing: original name -> new name.
  const [pendingRenames, setPendingRenames] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // tag editing state
  const [editingTag, setEditingTag] = useState<string | null>(null); // tag name being edited
  const [editValue, setEditValue] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingTag !== null) editInputRef.current?.focus();
  }, [editingTag]);

  useEffect(() => {
    if (addingTag) addInputRef.current?.focus();
  }, [addingTag]);

  // Close the add-tag dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!addingTag) return;
    function onMouseDown(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setAddingTag(false);
        setNewTagValue("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [addingTag]);

  const board = boards.find((b) => b.id === id);
  const boardConcepts = id ? concepts[id] ?? [] : [];
  const concept = boardConcepts.find((c) => c.id === conceptId);

  // Load the board's concepts (so the concept is in context), plus the
  // tag-id map and the detail row (which alone carries updated_at). Works for
  // deep links as well as navigation from the board page.
  useEffect(() => {
    if (!id || !conceptId) return;
    const boardId = id;
    const cid = conceptId;
    let cancelled = false;
    async function load() {
      try {
        const [tags, allBoardTags, detail] = await Promise.all([
          listConceptTags(boardId, cid),
          listTags(boardId),
          getConcept(boardId, cid),
        ]);
        await loadConcepts(boardId);
        if (!cancelled) {
          setTagMeta(tags);
          setBoardTags(allBoardTags);
          setLastReviewed(detail.updated_at ?? null);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load concept");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, conceptId, loadConcepts]);

  /** Reload the concept list + tag ids after a mutation so both stay in sync. */
  async function persistAndRefresh() {
    if (!id || !conceptId) return;
    await loadConcepts(id);
    const [conceptTags, allBoardTags] = await Promise.all([
      listConceptTags(id, conceptId),
      listTags(id),
    ]);
    setTagMeta(conceptTags);
    setBoardTags(allBoardTags);
  }

  /** Enter edit mode seeded with the current concept values. */
  function startEditing() {
    if (!concept) return;
    setDraftTitle(concept.title);
    setDraftAnswer(concept.answer);
    setDraftLearned(concept.learned);
    setDraftTags(concept.tags);
    setPendingRenames({});
    setIsEditing(true);
  }

  /** Discard local edits and leave edit mode without touching the backend. */
  function cancelEditing() {
    setIsEditing(false);
    setDraftTitle("");
    setDraftAnswer("");
    setDraftLearned(false);
    setDraftTags([]);
    setPendingRenames({});
  }

  /**
   * Persist staged edits as a single package. Computes the diffs against the
   * original concept and dispatches only the API calls that are actually
   * needed — saving an untouched concept is a local no-op.
   */
  async function saveConcept() {
    if (!id || !conceptId || !concept) return;
    const title = draftTitle.trim();
    const answer = draftAnswer.trim();
    const titleChanged = title !== concept.title;
    const answerChanged = answer !== concept.answer;
    const learnedChanged = draftLearned !== concept.learned;

    const renames = Object.entries(pendingRenames);
    const currentNameOf = (orig: string) => pendingRenames[orig] ?? orig;
    const removedOrig = concept.tags.filter((orig) => !draftTags.includes(currentNameOf(orig)));
    const addedTags = draftTags.filter(
      (n) => !concept.tags.some((orig) => currentNameOf(orig).toLowerCase() === n.toLowerCase())
    );

    const hasChanges =
      titleChanged ||
      answerChanged ||
      learnedChanged ||
      removedOrig.length > 0 ||
      addedTags.length > 0 ||
      renames.length > 0;
    if (!hasChanges) {
      cancelEditing();
      return;
    }

    setLoadError(null);
    setIsSaving(true);
    try {
      if (titleChanged || answerChanged) {
        await updateConcept(id, conceptId, { title, answer });
      }
      // Board-wide renames keep the tag id, so apply them before linking any
      // newly-added names that might collide with a rename target.
      for (const [orig, next] of renames) {
        const meta = tagMeta.find((t) => t.name === orig);
        if (meta) await updateTag(id, meta.tag_id, next);
      }
      if (addedTags.length > 0) {
        const existing = await listTags(id);
        const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t.tag_id]));
        const needCreate = addedTags.filter((n) => !byName.has(n.toLowerCase()));
        const created = needCreate.length > 0 ? await createTags(id, needCreate) : [];
        const ids = [
          ...addedTags.map((n) => byName.get(n.toLowerCase())),
          ...created.map((t) => t.tag_id),
        ].filter((x): x is string => Boolean(x));
        await linkTags(id, conceptId, ids);
      }
      for (const orig of removedOrig) {
        const meta = tagMeta.find((t) => t.name === orig);
        if (meta) await unlinkTag(id, conceptId, meta.tag_id);
      }
      if (learnedChanged) {
        await setConceptLearned(id, conceptId, draftLearned);
      }
      await persistAndRefresh();
      // The detail row alone carries the fresh updated_at for the
      // "last reviewed" line.
      const detail = await getConcept(id, conceptId);
      setLastReviewed(detail.updated_at ?? null);
      cancelEditing();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to save concept");
    } finally {
      setIsSaving(false);
    }
  }

  /** Map a displayed tag name back to the original name (if it was renamed). */
  function originalNameOf(displayName: string): string {
    for (const [orig, next] of Object.entries(pendingRenames)) {
      if (next === displayName) return orig;
    }
    return displayName;
  }

  // Names that map back to an original tag on this concept (with renames
  // applied). Chips in this set are the same tag as an original; chips outside
  // it are brand-new tags — even if their name matches a rename source, e.g.
  // after renaming n → n1 the name "n" is free to be a fresh tag again.
  const derivedNames = concept
    ? new Set(concept.tags.map((orig) => pendingRenames[orig] ?? orig))
    : new Set<string>();

  // Names the user is not allowed to create: anything already staged as a chip,
  // or a tag already on the concept (original names with renames applied). A
  // name a chip was renamed AWAY from (n → n1) is not in this set, so it can
  // still be created as a brand-new tag.
  const stagedOrCurrentNames = new Set(draftTags.map((t) => t.toLowerCase()));
  if (concept) {
    for (const orig of concept.tags) {
      stagedOrCurrentNames.add((pendingRenames[orig] ?? orig).toLowerCase());
    }
  }

  function startEditTag(tag: string) {
    setEditingTag(tag);
    setEditValue(tag);
  }

  /** Stage a rename of the tag being edited — nothing is sent yet. */
  function commitTagRename() {
    if (!editingTag) return;
    const trimmed = editValue.trim().toLowerCase();
    if (trimmed && trimmed !== editingTag) {
      // Don't rename into a name another tag on this concept already uses —
      // that would collide on the board's unique (board_id, name) constraint.
      const alreadyUsed = draftTags.some((t) => t !== editingTag && t.toLowerCase() === trimmed);
      if (!alreadyUsed) {
        // Only a chip that IS an original tag (or its renamed alias) stages a
        // board-wide rename; renaming a brand-new chip just changes the draft.
        if (derivedNames.has(editingTag)) {
          const orig = originalNameOf(editingTag);
          setPendingRenames((prev) => ({ ...prev, [orig]: trimmed }));
        }
        setDraftTags((prev) => prev.map((t) => (t === editingTag ? trimmed : t)));
      }
    }
    setEditingTag(null);
    setEditValue("");
  }

  /** Stage removal of a tag — nothing is sent yet. */
  function stageRemoveTag(tag: string) {
    // Removing a renamed chip also drops its staged rename (the original tag
    // leaves the concept); removing a brand-new chip leaves renames alone.
    if (derivedNames.has(tag)) {
      const orig = originalNameOf(tag);
      setPendingRenames((prev) => {
        const rest = { ...prev };
        delete rest[orig];
        return rest;
      });
    }
    setDraftTags((prev) => prev.filter((t) => t !== tag));
    setEditingTag(null);
  }

  /** Stage a tag add by name — nothing is sent until Save. */
  function stageAddTag(name: string) {
    const trimmed = name.trim().toLowerCase();
    // No duplicates: refuse a name already staged as a chip or already on the
    // concept. A name a chip was renamed away from (n → n1) is free again.
    if (!trimmed || stagedOrCurrentNames.has(trimmed)) return;
    setDraftTags((prev) => [...prev, trimmed]);
  }

  // Staged tag list as shown while editing: original tags with renames applied
  // and removals dropped, plus newly added tags.
  const editedTags = concept
    ? [
        ...concept.tags
          .filter((orig) => draftTags.includes(pendingRenames[orig] ?? orig))
          .map((orig) => pendingRenames[orig] ?? orig),
        ...draftTags.filter(
          (n) => !concept.tags.some((orig) => (pendingRenames[orig] ?? orig).toLowerCase() === n.toLowerCase())
        ),
      ]
    : [];

  // Add-tag dropdown: search the board's tags; a query that matches nothing
  // can be created as a brand-new tag (staged on select, not on typing).
  const tagQuery = newTagValue.trim().toLowerCase();
  const linkedNames = new Set(editedTags.map((t) => t.toLowerCase()));
  // A tag that was renamed no longer exists under its old name — that name is
  // the same tag as the new chip, so it must not appear as "available".
  for (const orig of Object.keys(pendingRenames)) linkedNames.add(orig.toLowerCase());
  // A tag still on the concept (even one staged for removal) can't be picked
  // or re-created, so keep it out of the suggestions as well.
  for (const n of stagedOrCurrentNames) linkedNames.add(n);
  const matchingBoardTags = (tagQuery ? boardTags.filter((t) => t.name.toLowerCase().includes(tagQuery)) : boardTags).filter(
    (t) => !linkedNames.has(t.name.toLowerCase())
  );
  const exactBoardTag = boardTags.find((t) => t.name.toLowerCase() === tagQuery);
  // A board tag whose name is staged for rename (n → n1) will stop occupying
  // that old name once saved, so creating a brand-new tag with it is allowed.
  const exactIsRenamedAway = exactBoardTag
    ? Object.prototype.hasOwnProperty.call(pendingRenames, exactBoardTag.name.toLowerCase())
    : false;
  const canCreateTag =
    tagQuery.length > 0 &&
    !stagedOrCurrentNames.has(tagQuery) &&
    (!exactBoardTag || exactIsRenamedAway);

  function handleNewTagKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const trimmed = newTagValue.trim().toLowerCase();
      if (!trimmed) return;
      const exact = boardTags.find((t) => t.name.toLowerCase() === trimmed);
      stageAddTag(exact ? exact.name : trimmed);
      setNewTagValue("");
    }
    if (e.key === "Escape") {
      setAddingTag(false);
      setNewTagValue("");
    }
  }

  function handleEditKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTagRename();
    }
    if (e.key === "Escape") setEditingTag(null);
  }

  if (isBoardsLoading || loading) {
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

  if (!concept) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <p className="text-sm">{loadError ?? "Concept not found."}</p>
        <button onClick={() => navigate(`/app/board/${id}`)} className="text-primary text-sm hover:underline">
          Back to board
        </button>
      </div>
    );
  }

  return (
    <>
      <main className="max-w-3xl mx-auto px-8 py-10 flex flex-col gap-8">
        {/* breadcrumb */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <button onClick={() => navigate("/app")} className="hover:text-foreground transition-colors">
              Dashboard
            </button>
            <span>/</span>
            <button
              onClick={() => navigate(`/app/board/${id}`)}
              className="hover:text-foreground transition-colors"
            >
              {board.title}
            </button>
            <span>/</span>
            <span className="text-foreground truncate">{concept.title}</span>
          </div>
          <button
            onClick={() => navigate(`/app/board/${id}`)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm w-fit mt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to board
          </button>
        </div>

        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-start justify-between gap-4">
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
                  style={{ fontFamily: "var(--font-sans)" }}
                />
              ) : (
                <h1 className="text-foreground leading-snug">{concept.title}</h1>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              {!isEditing && (
                <button
                  onClick={startEditing}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-mono border border-border hover:border-primary/40 px-2.5 py-1.5 rounded-lg"
                  title="Edit concept"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
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
            {editedTags.map((tag) => (
              <div key={tag} className="relative">
                <AnimatePresence mode="wait">
                  {editingTag === tag ? (
                    <motion.div
                      key="editing"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className="flex items-center gap-1 bg-card border border-primary/50 rounded-full px-2 py-1 shadow-lg shadow-black/30"
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onBlur={commitTagRename}
                        className="bg-transparent text-xs text-foreground font-mono focus:outline-none w-24"
                        style={{ fontFamily: "var(--font-mono)" }}
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          commitTagRename();
                        }}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setEditingTag(null);
                          setEditValue("");
                        }}
                        className="text-rose-400 hover:text-rose-300 transition-colors"
                        title="Cancel edit"
                        aria-label="Cancel tag edit"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="display"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      onClick={() => startEditTag(tag)}
                      className="group flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-mono border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-primary/10 transition-all cursor-pointer"
                      style={{ background: "rgba(139,111,245,0.06)" }}
                      title="Click to edit tag"
                    >
                      <span className="leading-none">
                        {tag}
                      </span>
                      <span className="flex items-center gap-1.5 overflow-hidden max-w-0 opacity-0 group-hover:max-w-10 group-hover:opacity-100 transition-all duration-150">
                        <Pencil className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            stageRemoveTag(tag);
                          }}
                          className="text-muted-foreground hover:text-rose-400 transition-colors shrink-0"
                          title="Remove tag"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* add tag — small dropdown with search, mirroring the tag bar
                in the AddConceptModal: type to filter, pick or create. */}
            <div ref={tagPickerRef} className="relative">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setAddingTag((o) => !o)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
                title="Add tag"
              >
                <Plus className="w-3 h-3" />
                Add tag
              </motion.button>

              <AnimatePresence>
                {addingTag && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full left-0 mt-2 w-72 z-20 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {/* search */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <input
                        ref={addInputRef}
                        type="text"
                        value={newTagValue}
                        onChange={(e) => setNewTagValue(e.target.value)}
                        onKeyDown={handleNewTagKeyDown}
                        placeholder="Search tags or type a new one…"
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      {newTagValue && (
                        <button
                          type="button"
                          onClick={() => setNewTagValue("")}
                          aria-label="Clear tag search"
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* suggestions */}
                    <div className="max-h-44 overflow-y-auto p-1.5 flex flex-col gap-0.5">
                      {canCreateTag && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            stageAddTag(tagQuery);
                            setNewTagValue("");
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono text-left transition-colors bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          Create “{tagQuery}”
                        </button>
                      )}
                      {matchingBoardTags.map((tag) => (
                        <button
                          key={tag.tag_id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            stageAddTag(tag.name);
                            setNewTagValue("");
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono text-left transition-colors bg-secondary text-muted-foreground hover:text-foreground hover:border-border"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          {tag.name}
                        </button>
                      ))}
                      {!canCreateTag && matchingBoardTags.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground font-mono">
                          No tags match “{tagQuery}”
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {concept.tags.length === 0 ? (
                <span className="text-xs text-muted-foreground font-mono">No tags</span>
              ) : (
                concept.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded-full font-mono border border-border text-muted-foreground"
                    style={{ background: "rgba(139,111,245,0.06)" }}
                  >
                    {tag}
                  </span>
                ))
              )}
            </div>
          )}

          {loadError && (
            <p className="text-xs text-rose-500 font-mono" role="alert">
              {loadError}
            </p>
          )}

          {/* meta */}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-mono flex-wrap">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {lastReviewed ? `Last reviewed: ${formatDate(lastReviewed)}` : "Never reviewed"}
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
          <div className="bg-card border border-border rounded-xl p-6">
            {isEditing ? (
              <textarea
                autoFocus
                value={draftAnswer}
                onChange={(e) => setDraftAnswer(e.target.value)}
                placeholder="Explain the concept in your own words…"
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-y"
                style={{ fontFamily: "var(--font-sans)" }}
              />
            ) : (
              <p className="text-foreground leading-relaxed text-sm">
                {concept.answer || <span className="text-muted-foreground italic">No answer added yet.</span>}
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
                onClick={cancelEditing}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={saveConcept}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setReviewOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Review again
            </button>
          )}
        </motion.div>
      </main>

      <ComingSoonModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Review again"
        description="Solo review mode for a single concept. We'll wire this up when quiz sessions land."
      />
    </>
  );
}
