import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { CheckCircle2, Eye, EyeOff, GraduationCap, KeyRound } from "lucide-react";
import { GuestOnly } from "../components/GuestOnly";
import { SystemTheme } from "../components/SystemTheme";
import { resetPassword } from "../lib/api";
import { validatePassword } from "../lib/password";

/**
 * Password reset page. The email's reset link arrives as
 * /reset-password?token=... — the page reads the token, collects a new
 * password, and posts it to POST /auth/reset-password. On success the token
 * is burned server-side and the user can sign in with the new password.
 */
export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = Boolean(password) && Boolean(confirmPassword) && password !== confirmPassword;
  const strengthError = password ? validatePassword(password) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mismatch || strengthError) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <GuestOnly>
      <SystemTheme />
      <div className="min-h-screen bg-background flex items-center justify-center px-4" style={{ fontFamily: "var(--font-sans)" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm flex flex-col gap-8"
        >
          {/* logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-foreground">Choose a new password</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter a new password for your account.
              </p>
            </div>
          </div>

          {done ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-6"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <p className="text-sm text-foreground text-center">
                Password updated — you can sign in with your new password now.
              </p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="mt-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
              >
                Sign in
              </button>
            </motion.div>
          ) : !token ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-6"
            >
              <KeyRound className="w-8 h-8 text-rose-400" />
              <p className="text-sm text-foreground text-center">
                This reset link is missing its token.
              </p>
              <p className="text-xs text-muted-foreground font-mono text-center">
                Use the link from your email, or request a new one.
              </p>
              <Link
                to="/forgot-password"
                className="text-primary text-sm hover:underline"
              >
                Request a new reset link
              </Link>
            </motion.div>
          ) : (
            <>
              {/* form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      className={`w-full px-4 py-2.5 pr-10 rounded-lg bg-secondary border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all ${
                        strengthError ? "border-rose-500/50" : "border-border"
                      }`}
                      style={{ fontFamily: "var(--font-sans)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {strengthError && (
                    <p className="text-[11px] text-rose-400 font-mono">{strengthError}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Confirm new password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className={`w-full px-4 py-2.5 pr-10 rounded-lg bg-secondary border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all ${
                        mismatch ? "border-rose-500/50" : "border-border"
                      }`}
                      style={{ fontFamily: "var(--font-sans)" }}
                    />
                  </div>
                  {mismatch && (
                    <p className="text-[11px] text-rose-400 font-mono">Passwords don't match</p>
                  )}
                </div>

                {submitError && (
                  <p className="text-xs text-rose-500 -mt-1" role="alert">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!password || !confirmPassword || mismatch || !!strengthError || isSubmitting}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Updating…" : "Update password"}
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                Remembered it?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </GuestOnly>
  );
}
