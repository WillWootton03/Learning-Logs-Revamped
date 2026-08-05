import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type TagState = {
  /**
   * Per-board cache of every tag name seen so far, used for the "tags from
   * this board" suggestions in the concept editor. Sorted, de-duplicated.
   */
  boardTagPool: Record<string, string[]>;
  /** Merge a batch of tag names into a board's pool. */
  seedBoardTags: (boardId: string, tags: string[]) => void;
  addTagToPool: (boardId: string, tag: string) => void;
  removeTagFromBoard: (boardId: string, tag: string) => void;
};

const TagContext = createContext<TagState | null>(null);

export function TagProvider({ children }: { children: ReactNode }) {
  const [boardTagPool, setBoardTagPool] = useState<Record<string, string[]>>({});

  const seedBoardTags = useCallback((boardId: string, tags: string[]) => {
    if (tags.length === 0) return;
    setBoardTagPool((prev) => ({
      ...prev,
      [boardId]: Array.from(new Set([...(prev[boardId] ?? []), ...tags])).sort(),
    }));
  }, []);

  const addTagToPool = useCallback((boardId: string, tag: string) => {
    setBoardTagPool((prev) => {
      const existing = prev[boardId] ?? [];
      if (existing.includes(tag)) return prev;
      return { ...prev, [boardId]: [...existing, tag].sort() };
    });
  }, []);

  const removeTagFromBoard = useCallback((boardId: string, tag: string) => {
    setBoardTagPool((prev) => ({
      ...prev,
      [boardId]: (prev[boardId] ?? []).filter((t) => t !== tag),
    }));
  }, []);

  return (
    <TagContext.Provider value={{ boardTagPool, seedBoardTags, addTagToPool, removeTagFromBoard }}>
      {children}
    </TagContext.Provider>
  );
}

export function useTags() {
  const ctx = useContext(TagContext);
  if (!ctx) throw new Error("useTags must be used inside TagProvider");
  return ctx;
}
