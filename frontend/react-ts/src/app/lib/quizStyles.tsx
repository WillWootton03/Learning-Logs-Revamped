/**
 * Shared question-type options for the quiz feature. Used by the session modal
 * (style picker) and the play page (active-type indicator) so the labels and
 * icons stay consistent in both places.
 */
import { AlignLeft, List, ToggleLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { QuizStyle } from "./api";

export const QUIZ_STYLE_OPTIONS: { id: QuizStyle; label: string; icon: ReactNode }[] = [
  { id: "true_false", label: "True / False", icon: <ToggleLeft className="w-3.5 h-3.5" /> },
  { id: "multiple_choice", label: "Multiple choice", icon: <List className="w-3.5 h-3.5" /> },
  { id: "fill_in", label: "Input answer", icon: <AlignLeft className="w-3.5 h-3.5" /> },
];

export function quizStyleLabel(style: QuizStyle): string {
  return QUIZ_STYLE_OPTIONS.find((o) => o.id === style)?.label ?? style;
}
