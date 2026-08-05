/**
 * Auth API routes — /auth/*. Sign-in, sign-up, session refresh, and sign-out.
 * On success the backend sets httpOnly JWT cookies; these functions resolve to
 * nothing because the client never needs the response body (the backend's
 * `user_id` never crosses to the frontend). Callers should re-fetch the
 * current user via users.ts to learn who is signed in.
 */
import { request } from "./client";

export function register(data: { email: string; password: string }) {
  return request<void>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function login(data: { email: string; password: string }) {
  return request<void>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function logout() {
  return request<void>("/auth/logout", { method: "POST" });
}

export function refresh() {
  return request<void>("/auth/refresh", { method: "POST" });
}
