import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

/**
 * Guard for pages that only signed-out users should see (landing, login,
 * signup). While the session is being restored (getMe / refresh), nothing
 * renders so a logged-in user never sees a flash of the page. Once the check
 * completes, authenticated users are redirected straight to the dashboard.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/app", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || isAuthenticated) return null;
  return <>{children}</>;
}
