/**
 * API layer barrel.
 *
 * Pages and contexts import from "../lib/api" and get the base client plus
 * every route module in one place. As more backend routes are consumed
 * (boards, concepts, logs, ...), add matching modules here.
 */
export { ApiError, request } from "./client";
export { register, login, logout, refresh } from "./auth";
export { getMe, type User } from "./users";
export { listBoards, createBoard } from "./boards";
export { listLogs, createLog, updateLog, deleteLog } from "./logs";
export { listConcepts, createConcept, updateConcept, setConceptLearned, listTags, createTag, linkTag, createTags, linkTags, getConcept, listConceptTags, unlinkTag, updateTag } from "./concepts";
