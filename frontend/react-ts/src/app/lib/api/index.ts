/**
 * API layer barrel.
 *
 * Pages and contexts import from "../lib/api" and get the base client plus
 * every route module in one place. As more backend routes are consumed
 * (boards, concepts, logs, ...), add matching modules here.
 */
export { ApiError, request } from "./client";
export { register, login, logout, refresh, verifyEmail, resendVerification, forgotPassword, resetPassword } from "./auth";
export { getMe, updateProfile, changePassword, deleteAccount, type User } from "./users";
export { listBoards, createBoard, updateBoard, deleteBoard } from "./boards";
export { listLogs, createLog, updateLog, deleteLog, deleteAllLogs } from "./logs";
export { listRuns, getRunBreakdown, deleteAllRuns } from "./sessions";
export type { SessionDetail, SessionDetailResult } from "./sessions";
export {
  listQuizSettings,
  createQuizSettings,
  updateQuizSettings,
  deleteQuizSettings,
  addQuizSettingsTags,
  removeQuizSettingsTags,
} from "./quizSettings";
export { generateQuestions, recordRun, recordRunFromSettings } from "./quizzes";
export type { QuizStyle, QuizQuestion, QuizAnswer, QuizScoredResult } from "./quizzes";
export { listConcepts, createConcept, updateConcept, setConceptLearned, deleteConcept, deleteAllConcepts, listTags, createTag, linkTag, createTags, linkTags, getConcept, listConceptTags, unlinkTag, updateTag, deleteTag, deleteAllTags, importConcepts } from "./concepts";
export type { ImportConceptRow } from "./concepts";
