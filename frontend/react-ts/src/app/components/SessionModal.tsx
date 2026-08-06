import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useConcepts } from "../context/ConceptContext";
import { useSessions } from "../context/SessionContext";
import { listTags } from "../lib/api";
import { useScrollLock } from "../hooks/useScrollLock";
import { Toggle } from "./Toggle";
import { QUIZ_STYLE_OPTIONS, quizStyleLabel } from "../lib/quizStyles";
import type { SessionPreset } from "../types";

type View = "list" | "edit";

type Props = {
  boardId: string;
  open: boolean;
  onClose: () => void;
  onStart?: (presetId: string) => void;
};

type TagMeta = { tag_id: string; name: string };

/** New presets default to multiple choice until the user picks another type. */
const DEFAULT_STYLE: SessionPreset["style"] = "multiple_choice";

/**
 * Modal for starting a session. Lists the board's saved settings (backend
 * quiz-settings), lets the user create/edit/delete them (name, include-learned,
 * tag filter, with a live preview count), and starts a session for one.
 */
export function SessionModal({ boardId, open, onClose, onStart }: Props) {
  useScrollLock(open);
  const { concepts, loadConcepts } = useConcepts();
  const {
    sessionPresets,
    loadSessionPresets,
    createSessionPreset,
    updateSessionPreset,
    deleteSessionPreset,
  } = useSessions();

  const [view, setView] = useState<View>("list");
  const [editingPreset, setEditingPreset] = useState<SessionPreset | null>(null);
  const [boardTags, setBoardTags] = useState<TagMeta[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const boardConcepts = concepts[boardId] ?? [];
  const presets = sessionPresets[boardId] ?? [];

  // Load the board's tags (id → name), saved settings, and concepts whenever
  // the modal opens so preview counts and the tag filter are fresh — the modal
  // can be opened from pages that haven't fetched concepts yet.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [tags] = await Promise.all([
          listTags(boardId),
          loadSessionPresets(boardId),
          loadConcepts(boardId),
        ]);
        if (!cancelled) setBoardTags(tags);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load settings");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, boardId, loadSessionPresets, loadConcepts]);

  const tagNameById = new Map(boardTags.map((t) => [t.tag_id, t.name]));

  /** Number of board concepts a setting's rules would include. */
  function previewCount(preset: SessionPreset): number {
    const allowedNames =
      preset.tagIds === null
        ? null
        : new Set(
            preset.tagIds.map((id) => tagNameById.get(id)).filter((n): n is string => Boolean(n))
          );
    return boardConcepts.filter((c) => {
      if (!preset.includeKnown && c.learned) return false;
      if (allowedNames !== null && !c.tags.some((t) => allowedNames.has(t))) return false;
      return true;
    }).length;
  }

  function openNew() {
    setEditingPreset({ id: "", name: "", style: DEFAULT_STYLE, includeKnown: true, tagIds: null });
    setView("edit");
  }

  function openEdit(preset: SessionPreset) {
    setEditingPreset({ ...preset });
    setView("edit");
  }

  function handleClose() {
    setView("list");
    setEditingPreset(null);
    setLoadError(null);
    onClose();
  }

  async function savePreset() {
    if (!editingPreset || !editingPreset.name.trim() || isSaving) return;
    const isNew = !editingPreset.id;
    setIsSaving(true);
    setLoadError(null);
    try {
      const payload = {
        name: editingPreset.name.trim(),
        style: editingPreset.style,
        includeKnown: editingPreset.includeKnown,
        tagIds: editingPreset.tagIds ?? [],
      };
      if (isNew) {
        await createSessionPreset(boardId, payload);
      } else {
        await updateSessionPreset(boardId, { ...editingPreset, name: payload.name });
      }
      setView("list");
      setEditingPreset(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to save setting");
    } finally {
      setIsSaving(false);
    }
  }

  function toggleTag(tagId: string) {
    setEditingPreset((prev) => {
      if (!prev) return prev;
      const current = prev.tagIds ?? [];
      const next = current.includes(tagId)
        ? current.filter((t) => t !== tagId)
        : [...current, tagId];
      return { ...prev, tagIds: next };
    });
  }

  const isEditing = !!editingPreset?.id;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <AnimatePresence mode="wait">
              {view === "list" ? (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-foreground">Start a session</h2>
                    <button
                      onClick={handleClose}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 px-6 py-4">
                    <p className="text-xs text-muted-foreground font-mono mb-2">
                      Choose a saved setting or create a new one
                    </p>

                    {loadError && <p className="text-xs text-rose-400 font-mono">{loadError}</p>}

                    {presets.length === 0 && !loadError && (
                      <p className="text-xs text-muted-foreground font-mono px-1 py-2">
                        No saved settings yet.
                      </p>
                    )}

                    {presets.map((preset) => {
                      const count = previewCount(preset);
                      return (
                        <div
                          key={preset.id}
                          className="group flex items-center gap-3 bg-secondary rounded-xl px-4 py-3 hover:border-primary/30 border border-transparent transition-all"
                        >
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              handleClose();
                              onStart?.(preset.id);
                            }}
                          >
                            <p className="text-sm text-foreground">{preset.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              {quizStyleLabel(preset.style)} · {count} concept{count !== 1 ? "s" : ""} ·{" "}
                              {preset.includeKnown ? "includes learned" : "unknown only"} ·{" "}
                              {preset.tagIds === null
                                ? "all tags"
                                : `${preset.tagIds.length} tag${preset.tagIds.length !== 1 ? "s" : ""}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(preset)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                              title="Edit setting"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteSessionPreset(boardId, preset.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                              title="Delete setting"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              handleClose();
                              onStart?.(preset.id);
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={`Start ${preset.name}`}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}

                    <button
                      onClick={openNew}
                      className="flex items-center gap-2 mt-1 px-4 py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create new setting
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* header */}
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                    <button
                      onClick={() => {
                        setView("list");
                        setEditingPreset(null);
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Back"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-foreground flex-1">
                      {isEditing ? "Edit setting" : "New setting"}
                    </h2>
                    <button
                      onClick={handleClose}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {editingPreset && (
                    <div className="flex flex-col gap-5 px-6 py-5">
                      {/* name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
                          Setting name
                        </label>
                        <input
                          autoFocus
                          type="text"
                          value={editingPreset.name}
                          onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                          placeholder="e.g. Quick review"
                          className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                          style={{ fontFamily: "var(--font-sans)" }}
                        />
                      </div>

                      {/* include known toggle */}
                      <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-secondary border border-border gap-4">
                        <div>
                          <p className="text-sm text-foreground">Include learned concepts</p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            Show concepts you've already marked as learned
                          </p>
                        </div>
                        <Toggle
                          checked={editingPreset.includeKnown}
                          onChange={(v) => setEditingPreset({ ...editingPreset, includeKnown: v })}
                        />
                      </div>

                      {/* question type */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
                          Question type
                        </label>
                        <div className="flex flex-col gap-1.5">
                          {QUIZ_STYLE_OPTIONS.map((opt) => {
                            const active = editingPreset.style === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setEditingPreset({ ...editingPreset, style: opt.id })}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  active
                                    ? "bg-primary/15 text-primary border border-primary/30"
                                    : "bg-secondary text-muted-foreground border border-transparent hover:text-foreground"
                                }`}
                              >
                                {opt.icon}
                                <span>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* tag filter */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
                            Tag filter
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingPreset({
                                ...editingPreset,
                                tagIds: editingPreset.tagIds === null ? [] : null,
                              })
                            }
                            className="text-[11px] text-primary hover:underline font-mono"
                          >
                            {editingPreset.tagIds === null
                              ? "Filter by tags"
                              : "Clear filter (all tags)"}
                          </button>
                        </div>

                        {editingPreset.tagIds !== null ? (
                          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                            {boardTags.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground font-mono px-1">
                                No tags on this board yet.
                              </p>
                            ) : (
                              boardTags.map((tag) => {
                                const active = editingPreset.tagIds!.includes(tag.tag_id);
                                return (
                                  <button
                                    key={tag.tag_id}
                                    type="button"
                                    onClick={() => toggleTag(tag.tag_id)}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                      active
                                        ? "bg-primary/15 text-primary border border-primary/30"
                                        : "bg-secondary text-muted-foreground border border-transparent hover:text-foreground"
                                    }`}
                                  >
                                    <span
                                      className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                                        active ? "bg-primary border-primary" : "border-border"
                                      }`}
                                    >
                                      {active && <Check className="w-2.5 h-2.5 text-white" />}
                                    </span>
                                    <span className="font-mono text-[12px]">{tag.name}</span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground font-mono px-1">
                            All tags included in this session.
                          </p>
                        )}
                      </div>

                      {/* preview */}
                      <div className="px-4 py-3 rounded-xl bg-secondary border border-border">
                        <p className="text-[11px] text-muted-foreground font-mono">
                          This setting will include{" "}
                          <span className="text-foreground">{previewCount(editingPreset)}</span> of{" "}
                          {boardConcepts.length} concept{boardConcepts.length !== 1 ? "s" : ""}
                        </p>
                      </div>

                      {loadError && <p className="text-xs text-rose-400 font-mono">{loadError}</p>}

                      {/* save */}
                      <button
                        type="button"
                        onClick={savePreset}
                        disabled={!editingPreset.name.trim() || isSaving}
                        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isSaving ? "Saving…" : "Save setting"}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
