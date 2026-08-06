/**
 * Auth API routes — /auth/*. Sign-in, sign-up, email verification, session
 * refresh, and sign-out. On success the backend sets httpOnly JWT cookies;
 * these functions resolve to nothing because the client never needs the
 * response body (the backend's `user_id` never crosses to the frontend).
 * Callers should re-fetch the current user via users.ts to learn who is
 * signed in.
 */
import { request } from "./client";

export function register(data: { email: string; password: string }) {
  return request<{ email: string; requiresVerification: boolean }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function login(data: { email: string; password: string }) {
  return request<{ user_id: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Confirm a stateless verification code; signs the user in on success. */
export function verifyEmail(code: string) {
  return request<{ user_id: string }>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/** Email a fresh verification code to an unverified account. */
export function resendVerification(email: string) {
  return request<{ email: string; resendAfterMs: number }>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Start a password reset for an email. Always answers 200 whether or not the
 * account exists (no account enumeration) — the UI just shows "check your
 * inbox".
 */
export function forgotPassword(email: string) {
  return request<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Set a new password using a token from a reset email. */
export function resetPassword(token: string, password: string) {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function logout() {
  return request<void>("/auth/logout", { method: "POST" });
}

export function refresh() {
  return request<void>("/auth/refresh", { method: "POST" });
}
