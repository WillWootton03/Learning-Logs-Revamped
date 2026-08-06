import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

type Props = {
  /** Route to navigate back to — the parent page. */
  to: string;
  /** Label next to the arrow, e.g. "Dashboard" or the board title. */
  label: string;
};

/**
 * Simple "← parent page" button. Same pattern as the dashboard back button on
 * the board page; each sub-page uses it to jump back to its own parent.
 */
export function BackButton({ to, label }: Props) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm w-fit"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
