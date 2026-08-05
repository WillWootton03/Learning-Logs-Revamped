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
};

export function getMe() {
  return request<User>("/users/me");
}
