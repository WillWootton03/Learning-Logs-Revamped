import { Outlet } from "react-router";
import { Navbar } from "../components/Navbar";

export function Root() {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "var(--font-sans)" }}>
      <Navbar />
      <Outlet />
    </div>
  );
}
