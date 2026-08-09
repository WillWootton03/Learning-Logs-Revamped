import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { motion } from "motion/react";
import { GraduationCap, KeyRound, MailCheck, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SystemTheme } from "../components/SystemTheme";

/**
 * Email verification page. Reachable three ways:
 *   1. Right after registration — the user must enter the code we emailed.
 *   2. After a blocked login (EMAIL_NOT_VERIFIED) — same flow, same page.
 *   3. Directly via ?token=... (clicking the link inside the email) — the
 *      code is submitted automatically.
 * On success the backend verifies the stateless JWT, marks the email verified,
 * and signs the user in, so we land on the dashboard.
 */
export function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pendingVerification, verifyEmail, resendVerification } = useAuth();

  const emailFromQuery = searchParams.get("email");
  const tokenFromQuery = searchParams.get("token");

  const [email, setEmail] = useState(pendingVerification?.email ?? emailFromQuery ?? "");
  const [code, setCode] = useState("");
  const [autoVerified, setAutoVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const emailLocked = !!emailFromQuery || !!pendingVerification;

  // Auto-verify when the email's verification link brought us here.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!tokenFromQuery || autoRan.current) return;
    autoRan.current = true;
    setCode(tokenFromQuery);
    (async () => {
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        await verifyEmail(tokenFromQuery);
        setAutoVerified(true);
        setTimeout(() => navigate("/app", { replace: true }), 1200);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to verify this code");
        setIsSubmitting(false);
      }
    })();
  }, [tokenFromQuery, verifyEmail, navigate]);

  // Tick the resend countdown down once per second while it's active.
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => {
      setCooldownLeft((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await verifyEmail(code.trim());
      navigate("/app", { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to verify this code");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    const target = (email || pendingVerification?.email || "").trim();
    if (!target) {
      setResendError("Enter your email to request a new code.");
      return;
    }
    setResendError(null);
    setResendSent(false);
    try {
      const waitMs = await resendVerification(target);
      setCooldownLeft(Math.ceil(waitMs / 1000));
      setResendSent(true);
    } catch (err) {
      // The backend reports remaining cooldown as 429 VERIFY_COOLDOWN; keep
      // the raw message (it already includes "please wait Ns").
      setResendError(err instanceof Error ? err.message : "Couldn't send a new code");
    }
  }

  return (
    <>
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
            <h1 className="text-foreground">Verify your email</h1>
            <p className="text-sm text-muted-foreground mt-1">
              We sent a code to{" "}
              <span className="text-foreground font-mono">{email || "your inbox"}</span>. Enter it
              below to finish creating your account.
            </p>
          </div>
        </div>

        {autoVerified ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-6"
          >
            <MailCheck className="w-8 h-8 text-emerald-400" />
            <p className="text-sm text-foreground">Email verified!</p>
            <p className="text-xs text-muted-foreground font-mono">Taking you to the dashboard…</p>
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
                  disabled={emailLocked}
                  className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all disabled:opacity-60"
                  style={{ fontFamily: "var(--font-sans)" }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Verification code</label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Paste the code from your email"
                    required
                    autoFocus={!tokenFromQuery}
                    className="w-full px-4 py-2.5 pr-10 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                    style={{ fontFamily: "var(--font-sans)" }}
                  />
                  <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {submitError && (
                <p className="text-xs text-rose-500 -mt-1" role="alert">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={!code.trim() || isSubmitting}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Verifying…" : "Verify email"}
              </button>
            </form>

            {/* resend */}
            <div className="flex flex-col items-center gap-2">
              {resendSent && !resendError && (
                <p className="text-xs text-emerald-400" role="status">
                  A new code is on its way.
                </p>
              )}
              {resendError && (
                <p className="text-xs text-rose-500" role="alert">
                  {resendError}
                </p>
              )}
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldownLeft > 0}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:no-underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {cooldownLeft > 0 ? `Request another code in ${cooldownLeft}s` : "Send a new code"}
              </button>
            </div>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already verified?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
    </>
  );
}
