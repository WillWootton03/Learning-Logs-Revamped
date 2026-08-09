import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  deleteAccount as apiDeleteAccount,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  refresh as apiRefresh,
  register as apiRegister,
  resendVerification as apiResendVerification,
  updateProfile as apiUpdateProfile,
  verifyEmail as apiVerifyEmail,
  ApiError,
  type User,
} from "../lib/api";

type AuthState = {
  /** The signed-in user, or null when not authenticated. */
  user: User | null;
  /** True while the initial session check (GET /users/me) is in flight. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * Set when an account is created or a login is blocked because the email
   * isn't verified yet. The verify page reads this to know which address to
   * show. Null once verification succeeds.
   */
  pendingVerification: { email: string } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  /** Confirm a stateless verification code; signs the user in on success. */
  verifyEmail: (code: string) => Promise<void>;
  /** Email a fresh verification code to an unverified account. */
  resendVerification: (email: string) => Promise<number>;
  clearPendingVerification: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Persist profile changes (name/email) and refresh local state. */
  updateProfile: (data: {
    name?: string;
    email?: string;
  }) => Promise<void>;
  /** Permanently delete the account (used by the settings danger zone). */
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVerification, setPendingVerification] = useState<{ email: string } | null>(null);

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
    try {
      await apiLogin({ email, password });
      setUser(await getMe());
    } catch (err) {
      // An unverified account can't be signed in — drop into the verify flow
      // with the address the backend confirmed.
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        setPendingVerification({ email: err.email ?? email });
      }
      throw err;
    }
  }

  async function register(email: string, password: string) {
    await apiRegister({ email, password });
    // Registration never signs the user in — it sends a verification code.
    setPendingVerification({ email });
  }

  async function verifyEmail(code: string) {
    await apiVerifyEmail(code);
    setUser(await getMe());
    setPendingVerification(null);
  }

  async function resendVerification(email: string): Promise<number> {
    const res = await apiResendVerification(email);
    return res.resendAfterMs;
  }

  function clearPendingVerification() {
    setPendingVerification(null);
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

  async function updateProfile(data: {
    name?: string;
    email?: string;
  }) {
    const updated = await apiUpdateProfile(data);
    setUser(updated);
  }

  async function deleteAccount() {
    await apiDeleteAccount();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        pendingVerification,
        login,
        register,
        verifyEmail,
        resendVerification,
        clearPendingVerification,
        logout,
        refresh,
        updateProfile,
        deleteAccount,
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
