/**
 * User API routes — /users/*. All endpoints are self-scoped to the signed-in
 * user (the backend reads the JWT, URL ids are ignored).
 */
import { request } from "./client";

// The backend returns user_id too, but the client deliberately drops it:
// identity comes from the httpOnly JWT cookies, and no endpoint ever needs
// the id from the frontend. Carrying only what the UI actually uses keeps
// the session surface small.
export type User = {
  email: string;
  /** Display name; null until the user provides one. */
  fullName: string | null;
  /** Whether the current email has been verified (false after an email change). */
  emailVerified: boolean;
  /** Account creation timestamp (profile page "Joined" line). */
  createdAt: string | null;
};

type UserRow = {
  email: string;
  full_name: string | null;
  email_verified: boolean;
  created_at: string | null;
};

function toUser(row: UserRow): User {
  return {
    email: row.email,
    fullName: row.full_name ?? null,
    emailVerified: row.email_verified,
    createdAt: row.created_at ?? null,
  };
}

export function getMe() {
  return request<UserRow>("/users/me").then(toUser);
}

/**
 * Update the signed-in user's profile. Name and/or email can change; empty
 * name clears the display name. Password changes have their own endpoint
 * (changePassword) so credential writes never share this code path.
 */
export function updateProfile(data: {
  name?: string;
  email?: string;
}) {
  return request<UserRow>("/users/me", {
    method: "PUT",
    body: JSON.stringify(data),
  }).then(toUser);
}

/**
 * Change the signed-in user's password. The backend verifies the current
 * password against the stored hash before replacing it with the new one.
 */
export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ user_id: string }>("/users/me/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** Permanently delete the signed-in account. */
export function deleteAccount() {
  return request<{ user_id: string }>("/users/me", {
    method: "DELETE",
  });
}
