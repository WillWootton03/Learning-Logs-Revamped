const UPPERCASE_RE = /[A-Z]/;
const SPECIAL_CHAR_RE = /[^A-Za-z0-9]/;

export const MIN_PASSWORD_LENGTH = 9; // "longer than 8 characters"

/**
 * Validate a password against the app's policy. Mirrors the backend
 * (authService.validatePasswordStrength) so the frontend catches weak
 * passwords before they hit the API.
 * @param password - The plaintext password.
 * @returns An error message, or null when the password is acceptable.
 */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `At least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!UPPERCASE_RE.test(password)) {
    return "At least one capital letter";
  }
  if (!SPECIAL_CHAR_RE.test(password)) {
    return "At least one special character";
  }
  return null;
}
