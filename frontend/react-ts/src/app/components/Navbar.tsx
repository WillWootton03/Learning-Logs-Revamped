import { useState, useRef, useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, useLocation, useMatch } from "react-router";
import {
  GraduationCap, Plus, Settings, LogOut, User,
  ChevronDown, BookOpen, Tag, Clock, FileText, ChevronRight, SlidersHorizontal, Menu,
} from "lucide-react";
import { useBoard } from "../context/BoardContext";
import { useAuth } from "../context/AuthContext";
import { displayName, initials } from "../lib/userName";

export function Navbar() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const boardMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuth();

  // Detect if we're inside a board (but not on /board/new)
  const boardMatchExact = useMatch("/app/board/:id");
  const boardMatchSub = useMatch("/app/board/:id/*");
  const boardMatch = boardMatchExact || boardMatchSub;
  const boardId = boardMatch?.params?.id;
  const isOnBoard = !!boardId && boardId !== "new";

  const { boards } = useBoard();
  const currentBoard = isOnBoard ? boards.find((b) => b.id === boardId) : null;

  const isAuth = location.pathname === "/login" || location.pathname === "/signup";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
      if (boardMenuRef.current && !boardMenuRef.current.contains(target)) {
        setBoardMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navLinkClass(path: string) {
    return `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
      location.pathname === path
        ? "bg-secondary text-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
    }`;
  }

  const displayNameValue = displayName(user?.fullName, user?.email);
  const initialsValue = initials(user?.fullName, user?.email);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-8 h-[4.5rem] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => navigate("/app")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="text-sm tracking-wide text-foreground">Learning Logs</span>
          </button>
          {currentBoard && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <button
                onClick={() => navigate(`/app/board/${boardId}`)}
                className="text-sm text-foreground hover:text-primary transition-colors truncate max-w-[140px] sm:max-w-[220px]"
                style={{ color: location.pathname === `/app/board/${boardId}` ? currentBoard.color : undefined }}
              >
                {currentBoard.title}
              </button>
            </>
          )}
        </div>

        {/* board-specific nav links — inline from md up; on mobile they live in
            the board dropdown next to the user menu */}
        {isOnBoard && !isAuth && (
          <nav className="hidden md:flex items-center gap-1">
            <button onClick={() => navigate(`/app/board/${boardId}/concepts`)} className={navLinkClass(`/app/board/${boardId}/concepts`)}>
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Concepts</span>
            </button>
            <button onClick={() => navigate(`/app/board/${boardId}/tags`)} className={navLinkClass(`/app/board/${boardId}/tags`)}>
              <Tag className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Tags</span>
            </button>
            <button onClick={() => navigate(`/app/board/${boardId}/sessions`)} className={navLinkClass(`/app/board/${boardId}/sessions`)}>
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Sessions</span>
            </button>
            <button onClick={() => navigate(`/app/board/${boardId}/logs`)} className={navLinkClass(`/app/board/${boardId}/logs`)}>
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Logs</span>
            </button>
            <button onClick={() => navigate(`/app/board/${boardId}/settings`)} className={navLinkClass(`/app/board/${boardId}/settings`)}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Settings</span>
            </button>
          </nav>
        )}

        {isAuth ? (
          <button onClick={() => navigate("/login")} className="text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto">
            Sign in
          </button>
        ) : (
          <div className="flex items-center gap-3 ml-auto flex-shrink-0">
            {/* Mobile board nav dropdown — replaces the New Board button on
                small screens when inside a board, so the board's sub-pages
                stay one tap away without a horizontally scrolling nav. */}
            {isOnBoard && (
              <div className="relative md:hidden" ref={boardMenuRef}>
                <button
                  onClick={() => setBoardMenuOpen((v) => !v)}
                  aria-label="Board menu"
                  className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${boardMenuOpen ? "bg-secondary" : "hover:bg-secondary/60"}`}
                >
                  <Menu className="w-4 h-4" />
                </button>

                <AnimatePresence>
                  {boardMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute -right-20 top-[calc(100%+8px)] w-48 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50"
                    >
                      <div className="px-4 py-2.5 border-b border-border truncate">
                        <p className="text-sm text-foreground truncate">{currentBoard?.title}</p>
                      </div>
                      <div className="py-1.5">
                        <DropdownItem icon={<BookOpen className="w-3.5 h-3.5" />} label="Concepts" onClick={() => { setBoardMenuOpen(false); navigate(`/app/board/${boardId}/concepts`); }} />
                        <DropdownItem icon={<Tag className="w-3.5 h-3.5" />} label="Tags" onClick={() => { setBoardMenuOpen(false); navigate(`/app/board/${boardId}/tags`); }} />
                        <DropdownItem icon={<Clock className="w-3.5 h-3.5" />} label="Sessions" onClick={() => { setBoardMenuOpen(false); navigate(`/app/board/${boardId}/sessions`); }} />
                        <DropdownItem icon={<FileText className="w-3.5 h-3.5" />} label="Logs" onClick={() => { setBoardMenuOpen(false); navigate(`/app/board/${boardId}/logs`); }} />
                        <DropdownItem icon={<SlidersHorizontal className="w-3.5 h-3.5" />} label="Settings" onClick={() => { setBoardMenuOpen(false); navigate(`/app/board/${boardId}/settings`); }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Inside a board the mobile dropdown takes over, so the New Board
                button stays desktop-only there. */}
            <button
              onClick={() => navigate("/app/board/new")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors ${isOnBoard ? "hidden sm:flex" : ""}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:block">New Board</span>
            </button>

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${userMenuOpen ? "bg-secondary" : "hover:bg-secondary/60"}`}
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <span className="text-[10px] text-primary font-mono">{initialsValue}</span>
                </div>
                <span className="text-sm text-foreground hidden sm:block">{displayNameValue}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 hidden sm:block ${userMenuOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-[calc(100%+8px)] w-52 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm text-foreground">{displayNameValue}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{user?.email}</p>
                    </div>
                    <div className="py-1.5">
                      <DropdownItem icon={<User className="w-3.5 h-3.5" />} label="Profile" onClick={() => { setUserMenuOpen(false); navigate("/app/profile"); }} />
                      <DropdownItem icon={<Settings className="w-3.5 h-3.5" />} label="Settings" onClick={() => { setUserMenuOpen(false); navigate("/app/settings"); }} />
                    </div>
                    <div className="border-t border-border py-1.5">
                      <DropdownItem icon={<LogOut className="w-3.5 h-3.5" />} label="Sign out" danger
                        onClick={async () => { setUserMenuOpen(false); await logout(); navigate("/login"); }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function DropdownItem({ icon, label, danger, onClick }: { icon: ReactNode; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${danger ? "text-rose-400 hover:bg-rose-400/10" : "text-foreground hover:bg-secondary"}`}
    >
      <span className={danger ? "text-rose-400" : "text-muted-foreground"}>{icon}</span>
      {label}
    </button>
  );
}
