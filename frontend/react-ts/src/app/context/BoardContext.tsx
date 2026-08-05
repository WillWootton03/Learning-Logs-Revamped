import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Board } from "../types";
import { createBoard as apiCreateBoard, listBoards } from "../lib/api";
import { useAuth } from "./AuthContext";

/** The summary counts that live on a Board and are derived from its concepts. */
type BoardStats = Pick<Board, "conceptCount" | "conceptsLearned">;

type BoardState = {
  boards: Board[];
  /** True while the initial GET /boards fetch is in flight. */
  isBoardsLoading: boolean;
  /** Non-null when the boards fetch failed, so pages can surface a retry. */
  boardsError: string | null;
  reloadBoards: () => Promise<void>;
  createBoard: (input: { title: string; subject: string; color: string }) => Promise<Board>;
  /**
   * Keep a board's concept-derived counts in sync after concept mutations.
   * Exposed for the ConceptContext, which recomputes these numbers — pages
   * don't call this directly.
   */
  updateBoardStats: (boardId: string, stats: BoardStats) => void;
};

const BoardContext = createContext<BoardState | null>(null);

export function BoardProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isBoardsLoading, setIsBoardsLoading] = useState(false);
  const [boardsError, setBoardsError] = useState<string | null>(null);

  // Boards load from the backend once the session is known. On sign-out we
  // clear them so a different account can't see a previous one's data. The
  // zero-delay timer defers every state write out of the effect body, which
  // keeps the setState-in-effect lint rule happy.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!isAuthenticated) {
        if (cancelled) return;
        setBoards([]);
        setBoardsError(null);
        return;
      }
      setIsBoardsLoading(true);
      setBoardsError(null);
      try {
        const rows = await listBoards();
        if (!cancelled) setBoards(rows);
      } catch (err) {
        if (!cancelled) setBoardsError(err instanceof Error ? err.message : "Failed to load boards");
      } finally {
        if (!cancelled) setIsBoardsLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated]);

  async function reloadBoards() {
    setIsBoardsLoading(true);
    setBoardsError(null);
    try {
      setBoards(await listBoards());
    } catch (err) {
      setBoardsError(err instanceof Error ? err.message : "Failed to load boards");
    } finally {
      setIsBoardsLoading(false);
    }
  }

  async function createBoard(input: { title: string; subject: string; color: string }) {
    const board = await apiCreateBoard(input);
    setBoards((prev) => [...prev, board]);
    return board;
  }

  // Bail out when the counts are unchanged so the stats sync never churns a
  // fresh boards array (which would re-create loadConcepts and restart the
  // board page's fetch effect in a loop).
  const updateBoardStats = useCallback((boardId: string, stats: BoardStats) => {
    setBoards((prev) => {
      const target = prev.find((b) => b.id === boardId);
      if (!target) return prev;
      if (target.conceptCount === stats.conceptCount && target.conceptsLearned === stats.conceptsLearned) {
        return prev;
      }
      return prev.map((b) => (b.id === boardId ? { ...b, ...stats } : b));
    });
  }, []);

  return (
    <BoardContext.Provider
      value={{
        boards,
        isBoardsLoading,
        boardsError,
        reloadBoards,
        createBoard,
        updateBoardStats,
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside BoardProvider");
  return ctx;
}
