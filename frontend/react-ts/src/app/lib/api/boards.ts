/**
 * Board API routes — /boards/*. Maps the backend snake_case rows onto the
 * frontend Board domain model (camelCase, title from name, humanized
 * last-used label, zero-defaulted counters).
 */
import { request } from "./client";
import type { Board } from "../../types";

type BoardRow = {
  board_id: string;
  name: string;
  subject: string;
  color: string;
  mastery_threshold?: number;
  concept_count?: number | null;
  learned_count?: number | null;
  session_count?: number | null;
  last_used_at?: string | null;
};

/** "Today" / "Yesterday" / "N days ago" / "Never" / short date. */
function humanizeLastUsed(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const then = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toBoard(row: BoardRow): Board {
  return {
    id: row.board_id,
    title: row.name,
    subject: row.subject,
    color: row.color,
    conceptCount: row.concept_count ?? 0,
    conceptsLearned: row.learned_count ?? 0,
    sessionCount: row.session_count ?? 0,
    // The backend has no streak tracking yet — stays 0 until a sessions model
    // can compute it.
    streakDays: 0,
    lastUsed: humanizeLastUsed(row.last_used_at),
  };
}

export async function listBoards() {
  const res = await request<{ boards: BoardRow[] }>("/boards");
  return res.boards.map(toBoard);
}

export function createBoard(data: { title: string; subject: string; color: string }) {
  return request<BoardRow>("/boards", {
    method: "POST",
    body: JSON.stringify({ name: data.title, subject: data.subject, color: data.color }),
  }).then(toBoard);
}
