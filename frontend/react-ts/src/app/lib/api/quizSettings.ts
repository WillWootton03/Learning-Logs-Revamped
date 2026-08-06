/**
 * Quiz settings (saved session presets) API — /boards/:boardId/quiz-settings.
 * A preset captures a quiz's name, style, include-known flag, and optional
 * tag filter. The backend works with tag *ids*, so the frontend model keeps
 * tagIds (null = all tags) and resolves names through the board's tag list.
 */
import { request } from "./client";
import type { SessionPreset } from "../../types";

export type QuizStyle = SessionPreset["style"];

type SettingsRow = {
  quiz_settings_id: string;
  name: string;
  style: QuizStyle;
  include_known: boolean;
  tag_ids: string[];
};

function toPreset(row: SettingsRow): SessionPreset {
  return {
    id: row.quiz_settings_id,
    name: row.name,
    style: row.style,
    includeKnown: row.include_known,
    tagIds: row.tag_ids.length > 0 ? row.tag_ids : null,
  };
}

export async function listQuizSettings(boardId: string) {
  const res = await request<{ settings: SettingsRow[] }>(`/boards/${boardId}/quiz-settings`);
  return res.settings.map(toPreset);
}

export function createQuizSettings(
  boardId: string,
  data: { name: string; style: QuizStyle; includeKnown: boolean; tagIds: string[] }
) {
  return request<SettingsRow>(`/boards/${boardId}/quiz-settings`, {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      style: data.style,
      includeKnown: data.includeKnown,
      tagIds: data.tagIds,
    }),
  }).then(toPreset);
}

/** Update a setting's name/style/include-known. Tags are managed separately. */
export function updateQuizSettings(
  boardId: string,
  settingsId: string,
  data: { name?: string; style?: QuizStyle; includeKnown?: boolean }
) {
  return request<SettingsRow>(`/boards/${boardId}/quiz-settings/${settingsId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }).then(toPreset);
}

export function deleteQuizSettings(boardId: string, settingsId: string) {
  return request<{ quiz_settings_id: string }>(
    `/boards/${boardId}/quiz-settings/${settingsId}`,
    { method: "DELETE" }
  );
}

/** Batch-link tag ids to a setting's filter. */
export function addQuizSettingsTags(boardId: string, settingsId: string, tagIds: string[]) {
  return request<SettingsRow>(`/boards/${boardId}/quiz-settings/${settingsId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tagIds }),
  }).then(toPreset);
}

/** Batch-unlink tag ids from a setting's filter. */
export function removeQuizSettingsTags(boardId: string, settingsId: string, tagIds: string[]) {
  return request<SettingsRow>(`/boards/${boardId}/quiz-settings/${settingsId}/tags`, {
    method: "DELETE",
    body: JSON.stringify({ tagIds }),
  }).then(toPreset);
}
