/**
 * Derive a display name and initials from a user's full name or, as a
 * fallback, their email's local part.
 *
 * The profile lets a user set a full name; when none is set the UI falls back
 * to deriving a friendly name from the email:
 * alex@example.com -> "Alex" / "AL". Helpers accept undefined/null so callers
 * never render an empty string.
 */

/** "Ada Lovelace" -> "Ada" — falls back to the email-derived name. */
export function displayName(fullName: string | null | undefined, email?: string): string {
  const fromName = fullName?.trim();
  if (fromName) return fromName;
  return displayNameFromEmail(email);
}

/** "Ada Lovelace" -> "AL" — falls back to the email-derived initials. */
export function initials(fullName: string | null | undefined, email?: string): string {
  const fromName = initialsFromName(fullName);
  if (fromName) return fromName;
  return initialsFromEmail(email);
}

/** First + last name initials, or the first two initials when longer. */
export function initialsFromName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
