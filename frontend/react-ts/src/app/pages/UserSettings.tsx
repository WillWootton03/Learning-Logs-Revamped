import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, KeyRound, Mail, MailCheck, Moon, Save, Sun } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ConfirmModal } from "../components/ConfirmModal";
import { forgotPassword } from "../lib/api";

export function UserSettings() {
  const navigate = useNavigate();
  const { user, updateProfile, deleteAccount, resendVerification } = useAuth();
  const { theme, setTheme } = useTheme();

  // Reset-by-email is gated on a verified address; without one the button is
  // disabled with a hover hint pointing at the verify flow.
  const emailVerified = user?.emailVerified ?? false;

  // Profile form — seeded from the signed-in user (RequireAuth guarantees the
  // session is restored before this page renders).
  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Unverified-email banner
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySending, setVerifySending] = useState(false);

  // Password reset (email link only — no in-menu password changes)
  const [resetSending, setResetSending] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Danger zone
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2000);
      // Changing the email marks it unverified; the fresh code was just emailed.
      if (email.trim().toLowerCase() !== (user?.email ?? "").toLowerCase()) {
        setVerifyNotice("We emailed a verification code to your new address.");
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSendVerification() {
    if (!user?.email || verifySending) return;
    setVerifySending(true);
    setVerifyError(null);
    setVerifyNotice(null);
    try {
      await resendVerification(user.email);
      setVerifyNotice("A new verification code is on its way.");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Couldn't send a new code");
    } finally {
      setVerifySending(false);
    }
  }

  async function handleSendResetLink() {
    if (!user?.email || resetSending) return;
    setResetSending(true);
    setResetError(null);
    setResetSent(false);
    try {
      await forgotPassword(user.email);
      setResetSent(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setResetSending(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleteOpen(false);
      setDeleting(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-8 py-10 flex flex-col gap-10">
      <div>
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </button>
        <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono mb-1">Account</p>
        <h1 className="text-foreground">Settings</h1>
      </div>

      {/* Unverified email */}
      {user?.emailVerified === false && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-card border border-amber-500/30 rounded-xl px-6 py-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <MailCheck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="text-sm text-foreground">Your email isn't verified yet</p>
              <p className="text-xs text-muted-foreground font-mono">
                {verifyNotice ?? "Check your inbox for a verification code."}
              </p>
              {verifyError && <p className="text-[11px] text-rose-400 font-mono">{verifyError}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/verify?email=${encodeURIComponent(user.email)}`)}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
            >
              Enter code
            </button>
            <button
              onClick={handleSendVerification}
              disabled={verifySending}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              {verifySending ? "Sending…" : "Send a new code"}
            </button>
          </div>
        </motion.section>
      )}

      {/* Appearance */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-foreground">Appearance</h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Choose how Learning Logs looks</p>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <ThemeOption
              active={theme === "light"}
              title="Light"
              subtitle="Lavender tinted"
              icon={<Sun className="w-4 h-4" />}
              onClick={() => setTheme("light")}
            />
            <ThemeOption
              active={theme === "dark"}
              title="Dark"
              subtitle="Deep purple"
              icon={<Moon className="w-4 h-4" />}
              onClick={() => setTheme("dark")}
            />
          </div>
        </div>
      </motion.section>

      {/* Profile */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-foreground">Profile</h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Update your name and email address</p>
        </div>
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 px-6 py-5">
          <TextField label="Full name" value={name} onChange={setName} placeholder="Your name" />
          <TextField label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
          {profileError && <p className="text-[11px] text-rose-400 font-mono">{profileError}</p>}
          <button
            type="submit"
            disabled={profileSaving}
            className="self-start flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {profileSaved ? <><Save className="w-3.5 h-3.5" />Saved!</> : <><Save className="w-3.5 h-3.5" />{profileSaving ? "Saving…" : "Save profile"}</>}
          </button>
        </form>
      </motion.section>

      {/* Password */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-foreground">Password</h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Reset your password by email</p>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <KeyRound className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="text-sm text-foreground">Forgot your password?</p>
                <p className="text-xs text-muted-foreground font-mono">
                  We'll email you a link to set a new password.
                </p>
              </div>
            </div>
            {emailVerified ? (
              <button
                onClick={handleSendResetLink}
                disabled={resetSending}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="w-3.5 h-3.5" />
                {resetSending ? "Sending…" : "Send reset link"}
              </button>
            ) : (
              <div className="relative shrink-0 group">
                <button
                  type="button"
                  aria-disabled="true"
                  disabled
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground/40 cursor-not-allowed"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Send reset link
                </button>
                {/* Disabled buttons don't fire hover, so the tooltip lives on
                    the wrapper and shows on group hover. */}
                <span className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground bg-card border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg shadow-black/40">
                  Verify your email to reset your password
                </span>
              </div>
            )}
          </div>
          {resetError && <p className="text-[11px] text-rose-400 font-mono">{resetError}</p>}
          {resetSent && (
            <p className="text-[11px] text-emerald-400 font-mono">
              Reset link sent — check your inbox.
            </p>
          )}
        </div>
      </motion.section>

      {/* Danger zone */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="bg-card border border-rose-500/20 rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-rose-500/20">
          <h2 className="text-rose-400">Danger zone</h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Irreversible account actions</p>
        </div>
        <div className="px-6 py-5">
          {deleteError && <p className="text-[11px] text-rose-400 font-mono mb-3">{deleteError}</p>}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-foreground">Delete account</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Permanently remove your account and all data</p>
            </div>
            {emailVerified ? (
              <button
                onClick={() => setDeleteOpen(true)}
                className="shrink-0 px-4 py-2 rounded-lg border border-rose-500/40 text-rose-400 text-sm hover:bg-rose-500/10 transition-colors"
              >
                Delete account
              </button>
            ) : (
              <div className="relative shrink-0 group">
                <button
                  type="button"
                  aria-disabled="true"
                  disabled
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground/40 cursor-not-allowed"
                >
                  Delete account
                </button>
                {/* Same wrapper-tooltip trick as the reset link: disabled
                    buttons don't fire hover, so the hint lives on the group. */}
                <span className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground bg-card border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg shadow-black/40">
                  Verify your email to delete your account
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <ConfirmModal
        open={deleteOpen}
        title="Delete account"
        description="This permanently deletes your account, all your boards, concepts, tags, sessions and logs. This cannot be undone."
        confirmLabel="Delete account"
        busy={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
      />
    </main>
  );
}

function ThemeOption({
  active,
  title,
  subtitle,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="text-left">
        <p className="text-sm">{title}</p>
        <p className="text-[11px] text-muted-foreground font-mono">{subtitle}</p>
      </div>
      {active && <div className="ml-auto w-2 h-2 rounded-full bg-primary" />}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        style={{ fontFamily: "var(--font-sans)" }}
      />
    </div>
  );
}
