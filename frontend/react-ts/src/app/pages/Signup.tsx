import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { motion } from "motion/react";
import { GraduationCap, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    setPasswordError(null);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await register(email, password);
      // The httpOnly JWT cookies are set by the backend; the account is live.
      navigate("/app");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
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
            <h1 className="text-foreground">Create an account</h1>
            <p className="text-sm text-muted-foreground mt-1">Start learning smarter with LearnBoard</p>
          </div>
        </div>

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
              className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              style={{ fontFamily: "var(--font-sans)" }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 pr-10 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
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
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Confirm password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 pr-10 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
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
          </div>

          {passwordError && (
            <p className="text-xs text-rose-500 -mt-1" role="alert">
              {passwordError}
            </p>
          )}

          {submitError && (
            <p className="text-xs text-rose-500 -mt-1" role="alert">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
