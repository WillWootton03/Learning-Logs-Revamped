/**
 * Base HTTP client for the LearnBoard backend.
 *
 * Every request goes to the Express server (VITE_API_URL) with
 * `credentials: 'include'` so the httpOnly JWT cookies set by /auth/* are sent
 * and received automatically. Non-2xx responses are thrown as ApiError
 * carrying the backend's `{ error }` message so callers can surface it in the
 * UI. Route-specific modules (auth, users, boards, ...) build on `request`.
 */

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!res.ok) {
    let message = "Something went wrong";
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body; keep the fallback message.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
