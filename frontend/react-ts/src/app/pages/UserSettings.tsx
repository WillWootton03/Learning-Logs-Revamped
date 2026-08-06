import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Eye, EyeOff, Moon, Save, Sun } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ConfirmModal } from "../components/ConfirmModal";

export function UserSettings() {
  const navigate = useNavigate();
  const { user, updateProfile, deleteAccount } = useAuth();
  const { theme, setTheme } = useTheme();

  // Profile form — seeded from the signed-in user (RequireAuth guarantees the
  // session is restored before this page renders).
  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Danger zone
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const passwordMismatch = Boolean(newPassword) && Boolean(confirmPassword) && newPassword !== confirmPassword;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordMismatch) return;
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await updateProfile({ password: newPassword, currentPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      window.setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setPasswordSaving(false);
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
          <p className="text-xs text-muted-foreground font-mono mt-0.5">Change your account password</p>
        </div>
        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4 px-6 py-5">
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            error={passwordMismatch ? "Passwords don't match" : undefined}
          />
          {passwordError && <p className="text-[11px] text-rose-400 font-mono">{passwordError}</p>}
          <button
            type="submit"
            disabled={!currentPassword || !newPassword || !!passwordMismatch || passwordSaving}
            className="self-start flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {passwordSaved ? <><Save className="w-3.5 h-3.5" />Updated!</> : <><Save className="w-3.5 h-3.5" />{passwordSaving ? "Updating…" : "Update password"}</>}
          </button>
        </form>
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
            <button
              onClick={() => setDeleteOpen(true)}
              className="shrink-0 px-4 py-2 rounded-lg border border-rose-500/40 text-rose-400 text-sm hover:bg-rose-500/10 transition-colors"
            >
              Delete account
            </button>
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

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className={`w-full px-4 py-2.5 pr-10 rounded-lg bg-secondary border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all ${
            error ? "border-rose-500/50" : "border-border"
          }`}
          style={{ fontFamily: "var(--font-sans)" }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-400 font-mono">{error}</p>}
    </div>
  );
}
