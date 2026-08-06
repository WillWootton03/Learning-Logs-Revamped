import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import {
  BookOpen, Check, CheckCircle2, Circle, FileText,
  Pencil, Plus, SlidersHorizontal, Tag, Trash2, X,
} from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { useConcepts } from "../context/ConceptContext";
import { useTags } from "../context/TagContext";
import { useLogs } from "../context/LogContext";
import { AddConceptModal } from "../components/AddConceptModal";
import { LogModal } from "../components/LogModal";
import { BackButton } from "../components/BackButton";
import { COLORS, SUBJECTS } from "../lib/boardOptions";
import {
  createTag, deleteTag, linkTag, listConceptTags, listTags, unlinkTag,
} from "../lib/api";
import type { Board, Log } from "../types";

type Tab = "settings" | "concepts" | "tags" | "logs";

export function BoardSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { boards, isBoardsLoading } = useBoard();
  const { concepts, loadConcepts, deleteConcept, updateConceptTags } = useConcepts();
  const { boardTagPool, addTagToPool, removeTagFromBoard } = useTags();
  const { logs, loadLogs, deleteLog } = useLogs();

  const [tab, setTab] = useState<Tab>("settings");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [boardTags, setBoardTags] = useState<{ tag_id: string; name: string }[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // modal state
  const [addConceptOpen, setAddConceptOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | null>(null);

  // inline tag add state (concepts tab)
  const [addingTagTo, setAddingTagTo] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState("");
  // inline tag add state (tags tab)
  const [addingNewTag, setAddingNewTag] = useState(false);
  const [newGlobalTag, setNewGlobalTag] = useState("");

  const board = boards.find((b) => b.id === id);
  const boardConcepts = id ? concepts[id] ?? [] : [];
  const boardLogs = id ? logs[id] ?? [] : [];
  const poolTags = id ? boardTagPool[id] ?? [] : [];
  const conceptTags = Array.from(new Set(boardConcepts.flatMap((c) => c.tags)));
  const allTags = Array.from(new Set([...conceptTags, ...poolTags, ...boardTags.map((t) => t.name)])).sort();
  const isLoading = loadedFor !== id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        await loadConcepts(id);
        const tags = await listTags(id);
        await loadLogs(id);
        if (!cancelled) {
          setBoardTags(tags);
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
  }, [id, loadConcepts, loadLogs]);

  async function reload() {
    if (!id) return;
    await loadConcepts(id);
    setBoardTags(await listTags(id));
    await loadLogs(id);
  }

  async function handleDeleteConcept(conceptId: string) {
    if (confirmDelete !== conceptId) {
      setConfirmDelete(conceptId);
      return;
    }
    setConfirmDelete(null);
    try {
      await deleteConcept(id!, conceptId);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to delete concept");
    }
  }

  async function handleDeleteTag(tagName: string) {
    const tagRow = boardTags.find((t) => t.name === tagName);
    if (!tagRow) return;
    const key = `tag:${tagName}`;
    if (confirmDelete !== key) {
      setConfirmDelete(key);
      return;
    }
    setConfirmDelete(null);
    try {
      await deleteTag(id!, tagRow.tag_id);
      removeTagFromBoard(id!, tagName);
      setBoardTags((prev) => prev.filter((t) => t.tag_id !== tagRow.tag_id));
      // Tag deletion cascades the unlink on the backend — refetch so no
      // concept still shows the removed tag.
      await loadConcepts(id!);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to delete tag");
    }
  }

  async function handleAddTagToConcept(conceptId: string) {
    const trimmed = newTagInput.trim().toLowerCase();
    setAddingTagTo(null);
    setNewTagInput("");
    if (!trimmed) return;
    const concept = boardConcepts.find((c) => c.id === conceptId);
    if (!concept || concept.tags.includes(trimmed)) return;
    try {
      let tag = boardTags.find((t) => t.name === trimmed);
      if (!tag) {
        tag = await createTag(id!, trimmed);
        setBoardTags((prev) => [...prev, tag]);
        addTagToPool(id!, trimmed);
      }
      await linkTag(id!, conceptId, tag.tag_id);
      updateConceptTags(id!, conceptId, [...concept.tags, trimmed]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to add tag");
    }
  }

  async function handleRemoveTagFromConcept(conceptId: string, tag: string) {
    const concept = boardConcepts.find((c) => c.id === conceptId);
    if (!concept) return;
    try {
      const rows = await listConceptTags(id!, conceptId);
      const target = rows.find((t) => t.name === tag);
      if (target) await unlinkTag(id!, conceptId, target.tag_id);
      updateConceptTags(id!, conceptId, concept.tags.filter((t) => t !== tag));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to remove tag");
    }
  }

  async function commitNewGlobalTag() {
    const trimmed = newGlobalTag.trim().toLowerCase();
    setAddingNewTag(false);
    setNewGlobalTag("");
    if (!trimmed || allTags.includes(trimmed)) return;
    try {
      const tag = await createTag(id!, trimmed);
      setBoardTags((prev) => [...prev, tag]);
      addTagToPool(id!, trimmed);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to create tag");
    }
  }

  async function handleDeleteLog(logId: string) {
    if (confirmDelete !== logId) {
      setConfirmDelete(logId);
      return;
    }
    setConfirmDelete(null);
    try {
      await deleteLog(id!, logId);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to delete log");
    }
  }

  const tabs: { key: Tab; label: string; icon: ReactNode; count?: number }[] = [
    { key: "settings", label: "Board settings", icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
    { key: "concepts", label: "Concepts", icon: <BookOpen className="w-3.5 h-3.5" />, count: boardConcepts.length },
    { key: "tags", label: "Tags", icon: <Tag className="w-3.5 h-3.5" />, count: allTags.length },
    { key: "logs", label: "Logs", icon: <FileText className="w-3.5 h-3.5" />, count: boardLogs.length },
  ];

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

  return (
    <>
      <main className="max-w-3xl mx-auto px-8 py-10 flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <BackButton to={`/app/board/${id}`} label={board.title} />
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
                setConfirmDelete(null);
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

        {loadError && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
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
        )}

        {/* board settings tab */}
        {tab === "settings" && <BoardSettingsForm key={board.id} board={board} onDeleted={() => navigate("/app")} />}

        {/* concepts tab */}
        {tab === "concepts" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{boardConcepts.length} concept{boardConcepts.length !== 1 ? "s" : ""}</p>
              <button
                onClick={() => setAddConceptOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add concept
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
            ) : boardConcepts.length === 0 ? (
              <Empty icon={<BookOpen />} text="No concepts yet." />
            ) : (
              boardConcepts.map((concept, i) => (
                <motion.div
                  key={concept.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl px-4 py-3 flex flex-col gap-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5 flex-shrink-0">
                      {concept.learned
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : <Circle className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{concept.title}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {concept.tags.map((tag) => (
                          <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                            {tag}
                            <button
                              onClick={() => handleRemoveTagFromConcept(concept.id, tag)}
                              className="hover:text-rose-400 transition-colors"
                              aria-label={`Remove ${tag} tag`}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        {addingTagTo === concept.id ? (
                          <div className="flex items-center gap-1 bg-card border border-primary/40 rounded-full px-2 py-0.5">
                            <input
                              autoFocus
                              type="text"
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); handleAddTagToConcept(concept.id); }
                                if (e.key === "Escape") { setAddingTagTo(null); setNewTagInput(""); }
                              }}
                              onBlur={() => handleAddTagToConcept(concept.id)}
                              placeholder="tag"
                              className="bg-transparent text-[11px] text-foreground font-mono focus:outline-none w-16"
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingTagTo(concept.id)}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            tag
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => navigate(`/app/board/${id}/concept/${concept.id}`)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Edit concept"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteConcept(concept.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          confirmDelete === concept.id
                            ? "bg-rose-500/15 text-rose-400"
                            : "text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                        }`}
                        title={confirmDelete === concept.id ? "Click again to confirm" : "Delete concept"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {confirmDelete === concept.id && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <p className="text-xs text-rose-400">Delete "{concept.title}"? This cannot be undone.</p>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-muted-foreground hover:text-foreground ml-3">
                        Cancel
                      </button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* tags tab */}
        {tab === "tags" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{allTags.length} tag{allTags.length !== 1 ? "s" : ""}</p>
              {addingNewTag ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-primary/40">
                    <span className="text-muted-foreground text-sm">#</span>
                    <input
                      autoFocus
                      type="text"
                      value={newGlobalTag}
                      onChange={(e) => setNewGlobalTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitNewGlobalTag(); }
                        if (e.key === "Escape") { setAddingNewTag(false); setNewGlobalTag(""); }
                      }}
                      onBlur={commitNewGlobalTag}
                      placeholder="tag name"
                      className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-28 font-mono"
                    />
                  </div>
                  <button
                    onClick={() => { setAddingNewTag(false); setNewGlobalTag(""); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingNewTag(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add tag
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
            ) : allTags.length === 0 ? (
              <Empty icon={<Tag />} text="No tags yet. Add your first one above." />
            ) : (
              allTags.map((tag, i) => {
                const tagConcepts = boardConcepts.filter((c) => c.tags.includes(tag));
                const isPoolOnly = tagConcepts.length === 0;
                return (
                  <motion.div
                    key={tag}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className={`bg-card border rounded-xl px-4 py-3 flex flex-col gap-2 ${isPoolOnly ? "border-primary/20 border-dashed" : "border-border"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-foreground flex-1">#{tag}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {isPoolOnly ? <span className="text-primary/60">unused</span> : `${tagConcepts.length} concept${tagConcepts.length !== 1 ? "s" : ""}`}
                      </span>
                      <button
                        onClick={() => handleDeleteTag(tag)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          confirmDelete === `tag:${tag}`
                            ? "bg-rose-500/15 text-rose-400"
                            : "text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                        }`}
                        title={confirmDelete === `tag:${tag}` ? "Click again to confirm" : "Remove tag"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {confirmDelete === `tag:${tag}` && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <p className="text-xs text-rose-400">
                          {isPoolOnly ? `Delete tag "#${tag}"?` : `Remove "#${tag}" from all ${tagConcepts.length} concepts?`}
                        </p>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs text-muted-foreground hover:text-foreground ml-3">
                          Cancel
                        </button>
                      </div>
                    )}
                    {tagConcepts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tagConcepts.map((c) => (
                          <span key={c.id} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                            {c.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}

        {/* logs tab */}
        {tab === "logs" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{boardLogs.length} log{boardLogs.length !== 1 ? "s" : ""}</p>
              <button
                onClick={() => { setEditingLog(null); setLogModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/25 text-sm hover:bg-primary/25 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New log
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
            ) : boardLogs.length === 0 ? (
              <Empty icon={<FileText />} text="No logs yet." />
            ) : (
              boardLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl px-4 py-3 flex flex-col gap-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{log.title}</p>
                      {log.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{log.body}</p>}
                      <p className="text-[10px] text-muted-foreground font-mono mt-1">{log.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingLog(log); setLogModalOpen(true); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Edit log"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          confirmDelete === log.id
                            ? "bg-rose-500/15 text-rose-400"
                            : "text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                        }`}
                        title={confirmDelete === log.id ? "Click again to confirm" : "Delete log"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {confirmDelete === log.id && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <p className="text-xs text-rose-400">Delete this log? This cannot be undone.</p>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-muted-foreground hover:text-foreground ml-3">
                        Cancel
                      </button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </main>

      <AddConceptModal boardId={id!} open={addConceptOpen} onClose={() => setAddConceptOpen(false)} />
      <LogModal
        key={editingLog?.id ?? "new"}
        boardId={id!}
        log={editingLog}
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
      />
    </>
  );
}

/**
 * Board settings editor: name, subject, color, mastery threshold, and delete.
 * Remounted per board (key=board.id) so state initializes from the current
 * board, and saving only sends the fields that actually changed.
 */
function BoardSettingsForm({ board, onDeleted }: { board: Board; onDeleted: () => void }) {
  const { updateBoard, deleteBoard } = useBoard();
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

  async function handleSave() {
    if (!title.trim() || !finalSubject.trim()) {
      setError("Name and subject are required.");
      return;
    }
    const changes: { name?: string; subject?: string; color?: string; masteryThreshold?: number } = {};
    if (title.trim() !== board.title) changes.name = title.trim();
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
    try {
      await updateBoard(board.id, changes);
      setSaveMessage("Board settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    setIsDeleting(true);
    try {
      await deleteBoard(board.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsDeleting(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
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
            <p className="text-xs text-rose-400">Delete "{board.title}"? This removes all its concepts, tags, logs, and sessions.</p>
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
    </motion.div>
  );
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border border-dashed border-border rounded-xl">
      <div className="w-8 h-8 opacity-30">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
