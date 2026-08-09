import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { GraduationCap, MailCheck, Send } from "lucide-react";
import { GuestOnly } from "../components/GuestOnly";
import { SystemTheme } from "../components/SystemTheme";
import { forgotPassword } from "../lib/api";

/**
 * "Forgot password?" — enter your email and we email a reset link. The
 * backend answers the same way whether or not the account exists, so the
 * page always shows the "check your inbox" confirmation.
 */
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
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
              <h1 className="text-foreground">Reset your password</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your account email and we'll send you a reset link.
              </p>
            </div>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-6"
            >
              <MailCheck className="w-8 h-8 text-emerald-400" />
              <p className="text-sm text-foreground text-center">
                If that email is registered, a reset link is on its way.
              </p>
              <p className="text-xs text-muted-foreground font-mono text-center">
                It expires in 1 hour — check your inbox (and spam folder).
              </p>
            </motion.div>
          ) : (
            <>
              {/* form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    required
                    autoFocus
                    className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                    style={{ fontFamily: "var(--font-sans)" }}
                  />
                </div>

                {submitError && (
                  <p className="text-xs text-rose-500 -mt-1" role="alert">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!email.trim() || isSubmitting}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors mt-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? "Sending…" : "Send reset link"}
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
