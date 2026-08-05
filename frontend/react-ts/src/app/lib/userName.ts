/**
 * Derive a display name and initials from an email's local part.
 *
 * The backend only stores an email, so the UI derives a friendly name from it:
 * alex@example.com -> "Alex" / "AL". Falls back to a neutral value when no
 * email is available so callers never render an empty string.
 */

export function displayNameFromEmail(email: string | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function initialsFromEmail(email: string | undefined): string {
  if (!email) return "";
  return (email.split("@")[0] ?? "").slice(0, 2).toUpperCase();
}
