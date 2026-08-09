/**
 * Base HTTP client for the Learning Logs backend.
 *
 * Every request goes to the Express server (VITE_API_URL) with
 * `credentials: 'include'` so the httpOnly JWT cookies set by /auth/* are sent
 * and received automatically. Non-2xx responses are thrown as ApiError
 * carrying the backend's `{ error }` message so callers can surface it in the
 * UI. Route-specific modules (auth, users, boards, ...) build on `request`.
 *
 * Token refresh: when a protected route returns 401 (expired access token),
 * `request` calls POST /auth/refresh — a dedicated, observable endpoint — and
 * retries the original call once. The retry logic lives here in the shared
 * client, so every service gets the same behavior with no per-service code.
 * Parallel 401s share a single in-flight refresh promise to avoid firing
 * redundant refresh calls (the backend keeps the refresh token static, so
 * concurrent refreshes are safe either way).
 */

export class ApiError extends Error {
  status: number;
  /** Optional machine-readable code (e.g. "EMAIL_NOT_VERIFIED") from the backend. */
  code?: string;
  /** Optional email carried on auth failures (e.g. an unverified login). */
  email?: string;

  constructor(status: number, message: string, code?: string, email?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.email = email;
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Endpoints whose 401 means "bad credentials", not "session expired". A wrong
 * password on login or a duplicate register must surface as-is — they must
 * never be retried against an unrelated session.
 */
const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/register", "/auth/refresh"]);

/** Shared in-flight refresh, so N parallel 401s trigger exactly one call. */
let refreshPromise: Promise<boolean> | null = null;

/**
 * Cloudflare sometimes serves an interstitial challenge page (403 + the
 * `cf-mitigated: challenge` header) on an API call — e.g. after the
 * `cf_clearance` cookie expires following a long idle period. A `fetch()`
 * can't render that page, so the request would just fail silently. When we
 * detect it, we reload the document once; the browser navigates, passes the
 * challenge, sets a fresh clearance cookie, and the app resumes.
 */
let challengeReloadQueued = false;

function isCloudflareChallenge(res: Response): boolean {
  return res.status === 403 && res.headers.get("cf-mitigated") === "challenge";
}

async function doFetch(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (isCloudflareChallenge(res) && !challengeReloadQueued) {
    challengeReloadQueued = true;
    window.location.reload();
  }
  return res;
}

/**
 * Exchange the refresh cookie for a fresh access token via POST /auth/refresh.
 * Resolves true when the exchange succeeded (the backend wrote a new access
 * cookie, which the browser stores automatically). The refresh token is
 * static — never rotated — so concurrent refreshes are safe; the shared
 * promise still avoids firing N of them at once.
 */
function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doFetch("/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await doFetch(path, init);

  if (res.status === 401 && !NO_REFRESH_PATHS.has(path)) {
    // Expired access token — refresh once, then replay the original request.
    // The retry picks up the fresh httpOnly access cookie the browser just
    // stored. If refresh fails (no cookie, expired session), we fall through
    // and surface the original 401.
    if (await refreshAccessToken()) {
      res = await doFetch(path, init);
    }
  }

  if (!res.ok) {
    let message = "Something went wrong";
    let code: string | undefined;
    let email: string | undefined;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      if (typeof body?.code === "string") code = body.code;
      if (typeof body?.email === "string") email = body.email;
    } catch {
      // Non-JSON error body; keep the fallback message.
    }
    throw new ApiError(res.status, message, code, email);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
