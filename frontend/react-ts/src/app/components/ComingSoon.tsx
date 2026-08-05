import { useNavigate } from "react-router";
import { Construction, ArrowLeft } from "lucide-react";

type ComingSoonProps = {
  title: string;
  description?: string;
};

/**
 * Shared placeholder for pages whose Figma design hasn't been implemented yet.
 * Gives every route a themed, on-brand state instead of a blank screen.
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-8 py-24 flex flex-col items-center text-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
        <Construction className="w-6 h-6 text-primary" />
      </div>
      <h1 className="text-foreground text-2xl">{title}</h1>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{description}</p>
      )}
      <p className="text-xs text-muted-foreground font-mono mt-2">Coming soon</p>
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to landing
      </button>
    </div>
  );
}
