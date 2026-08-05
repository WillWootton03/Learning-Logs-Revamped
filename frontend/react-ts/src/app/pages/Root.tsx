import { Outlet } from "react-router";
import { Navbar } from "../components/Navbar";
import { RequireAuth } from "../components/RequireAuth";

export function Root() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
        <Navbar />
        <Outlet />
      </div>
    </RequireAuth>
  );
}
