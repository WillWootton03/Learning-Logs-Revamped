/**
 * Concept + tag API routes — /boards/:boardId/concepts and /boards/:boardId/tags.
 * Maps backend snake_case rows onto the frontend Concept model. "Learned" is
 * derived from times_answered_correctly against the board's mastery threshold
 * (passed in so this module stays stateless).
 */
import { request } from "./client";
import type { Concept } from "../../types";

type ConceptRow = {
  concept_id: string;
  prompt: string;
  answer: string;
  hint?: string | null;
  times_answered_correctly: number;
  tags?: string[] | null;
};

type TagRow = {
  tag_id: string;
  name: string;
};

function toConcept(row: ConceptRow, masteryThreshold: number): Concept {
  return {
    id: row.concept_id,
    title: row.prompt,
    answer: row.answer,
    hint: row.hint ?? null,
    learned: row.times_answered_correctly >= masteryThreshold,
    tags: row.tags ?? [],
    // The list endpoint doesn't return timestamps (summary only) — the board
    // page simply hides the "last reviewed" column until a detail fetch.
    lastReviewed: null,
  };
}

export async function listConcepts(boardId: string, masteryThreshold: number) {
  const res = await request<{ concepts: ConceptRow[] }>(`/boards/${boardId}/concepts`);
  return res.concepts.map((row) => toConcept(row, masteryThreshold));
}

/**
 * Fetch a single concept's detail row. The get-by-id endpoint is the only one
 * that returns the full columns (hint, updated_at), so this is used for the
 * concept detail page's "last reviewed" line.
 */
export async function getConcept(boardId: string, conceptId: string) {
  return request<ConceptRow & { updated_at: string | null }>(
    `/boards/${boardId}/concepts/${conceptId}`
  );
}

export function createConcept(boardId: string, data: { prompt: string; answer: string }) {
  return request<ConceptRow>(`/boards/${boardId}/concepts`, {
    method: "POST",
    body: JSON.stringify({ prompt: data.prompt, answer: data.answer }),
  });
}

/** A single CSV-derived row: prompt/answer/hint strings plus a tag-name list. */
export type ImportConceptRow = {
  prompt: string;
  answer: string;
  hint: string | null;
  tags: string[];
};

/**
 * Bulk-import concepts with their tags in one transactional call. The backend
 * batch-creates tags, then concepts, then the links.
 */
export async function importConcepts(boardId: string, rows: ImportConceptRow[]) {
  const res = await request<{ concepts: ConceptRow[] }>(`/boards/${boardId}/concepts/import`, {
    method: "POST",
    body: JSON.stringify({ concepts: rows }),
  });
  return res.concepts;
}

/** Update a concept's prompt, answer, and/or hint. Fields not passed are left unchanged. */
export function updateConcept(
  boardId: string,
  conceptId: string,
  data: { prompt?: string; answer?: string; hint?: string | null }
) {
  return request<ConceptRow>(`/boards/${boardId}/concepts/${conceptId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteConcept(boardId: string, conceptId: string) {
  return request<{ concept_id: string }>(`/boards/${boardId}/concepts/${conceptId}`, {
    method: "DELETE",
  });
}

/** Delete every concept on a board. */
export function deleteAllConcepts(boardId: string) {
  return request<{ deleted: number }>(`/boards/${boardId}/concepts`, {
    method: "DELETE",
  });
}

/**
 * Set a concept's learned status. Persists by moving the mastery counter to
 * the board's mastery threshold (learned) or back to 0 (unlearned).
 */
export function setConceptLearned(boardId: string, conceptId: string, learned: boolean) {
  return request<ConceptRow>(`/boards/${boardId}/concepts/${conceptId}/learned`, {
    method: "PUT",
    body: JSON.stringify({ learned }),
  });
}

/** All tags on a board — used to resolve names to ids when linking. */
export async function listTags(boardId: string) {
  const res = await request<{ tags: TagRow[] }>(`/boards/${boardId}/tags`);
  return res.tags;
}

export function createTag(boardId: string, name: string) {
  return request<TagRow>(`/boards/${boardId}/tags`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

/** Batch-create tags from a list of names; existing names are skipped. */
export async function createTags(boardId: string, names: string[]) {
  const res = await request<{ tags: TagRow[] }>(`/boards/${boardId}/tags/bulk`, {
    method: "POST",
    body: JSON.stringify({ names }),
  });
  return res.tags;
}

export function linkTag(boardId: string, conceptId: string, tagId: string) {
  return request<{ concept_id: string; tag_id: string }>(
    `/boards/${boardId}/concepts/${conceptId}/tags/${tagId}`,
    { method: "PUT" }
  );
}

/** Batch-link tags to a concept in one call. */
export function linkTags(boardId: string, conceptId: string, tagIds: string[]) {
  return request<{ concept_id: string; tag_ids: string[] }>(
    `/boards/${boardId}/concepts/${conceptId}/tags`,
    { method: "PUT", body: JSON.stringify({ tagIds }) }
  );
}

/** List the tags attached to a concept, with their ids (needed to rename/unlink). */
export async function listConceptTags(boardId: string, conceptId: string) {
  const res = await request<{ tags: TagRow[] }>(
    `/boards/${boardId}/concepts/${conceptId}/tags`
  );
  return res.tags;
}

/** Unlink a tag from a concept. */
export function unlinkTag(boardId: string, conceptId: string, tagId: string) {
  return request<{ concept_id: string }>(
    `/boards/${boardId}/concepts/${conceptId}/tags/${tagId}`,
    { method: "DELETE" }
  );
}

/** Rename a tag on the board. */
export function updateTag(boardId: string, tagId: string, name: string) {
  return request<TagRow>(`/boards/${boardId}/tags/${tagId}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

/** Delete a tag from the board (unlinks it from all concepts). */
export function deleteTag(boardId: string, tagId: string) {
  return request<{ tag_id: string }>(`/boards/${boardId}/tags/${tagId}`, {
    method: "DELETE",
  });
}

/** Delete every tag on a board (unlinks them from all concepts). */
export function deleteAllTags(boardId: string) {
  return request<{ deleted: number }>(`/boards/${boardId}/tags`, {
    method: "DELETE",
  });
}
