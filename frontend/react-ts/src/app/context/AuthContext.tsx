import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  refresh as apiRefresh,
  register as apiRegister,
  type User,
} from "../lib/api";

type AuthState = {
  /** The signed-in user, or null when not authenticated. */
  user: User | null;
  /** True while the initial session check (GET /users/me) is in flight. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the session on first load. Try GET /users/me first: a valid
  // access cookie resolves it and we're signed in without a re-login. If the
  // access token is missing/expired, the backend may still hold a valid
  // refresh cookie — so attempt refresh(), which mints a fresh access token,
  // then retry. Only when both fail do we declare the user signed out.
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const me = await getMe();
        if (!cancelled) setUser(me);
      } catch {
        try {
          await apiRefresh();
          const me = await getMe();
          if (!cancelled) setUser(me);
        } catch {
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    await apiLogin({ email, password });
    setUser(await getMe());
  }

  async function register(email: string, password: string) {
    await apiRegister({ email, password });
    setUser(await getMe());
  }

  async function logout() {
    // Best effort — clear local state even if the API call fails.
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }

  async function refresh() {
    await apiRefresh();
    setUser(await getMe());
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
