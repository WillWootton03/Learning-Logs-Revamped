/**
 * Log API routes — /boards/:boardId/logs. Maps backend snake_case rows onto
 * the frontend Log model (content → body). The backend only exposes
 * updated_at (summary rows never carry created_at), so createdAt falls back
 * to updated_at — the "edited" marker is only meaningful for edits made
 * during the current session, when updateLog bumps updatedAt locally.
 */
import { request } from "./client";
import type { Log } from "../../types";

type LogRow = {
  log_id: string;
  title: string;
  content: string;
  updated_at: string;
};

function toLog(row: LogRow, boardId: string): Log {
  return {
    id: row.log_id,
    boardId,
    title: row.title,
    body: row.content,
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
  };
}

export async function listLogs(boardId: string) {
  const res = await request<{ logs: LogRow[] }>(`/boards/${boardId}/logs`);
  return res.logs.map((row) => toLog(row, boardId));
}

export function createLog(boardId: string, data: { title: string; body: string }) {
  return request<LogRow>(`/boards/${boardId}/logs`, {
    method: "POST",
    body: JSON.stringify({ title: data.title, content: data.body }),
  }).then((row) => toLog(row, boardId));
}

/** Update a log's title and/or body. Fields not passed are left unchanged. */
export function updateLog(
  boardId: string,
  logId: string,
  data: { title?: string; body?: string }
) {
  return request<LogRow>(`/boards/${boardId}/logs/${logId}`, {
    method: "PUT",
    body: JSON.stringify({ title: data.title, content: data.body }),
  }).then((row) => toLog(row, boardId));
}

export function deleteLog(boardId: string, logId: string) {
  return request<{ log_id: string }>(`/boards/${boardId}/logs/${logId}`, {
    method: "DELETE",
  });
}
