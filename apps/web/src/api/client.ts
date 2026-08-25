/**
 * HTTP client.
 *
 * Two behaviours matter beyond "call fetch":
 *
 *  1. **Transparent token refresh.** Access tokens last 15 minutes, so an
 *     expiring token mid-session must not log the user out. On a 401 the client
 *     refreshes once and replays the request.
 *  2. **Single-flight refresh.** A dashboard fires several requests at once;
 *     if the token expired they would all 401 together. Without coordination
 *     each would refresh, and because refresh tokens rotate, the second would
 *     present an already-rotated token — which the server correctly treats as
 *     theft and revokes the whole session. So concurrent refreshes share one
 *     in-flight promise.
 */

const API_BASE = import.meta.env['VITE_API_URL'] ?? '/api';

const ACCESS_KEY = 'mt_access';
const REFRESH_KEY = 'mt_refresh';

export interface FieldIssue {
  path: string;
  message: string;
}

/** Thrown for any non-2xx response. Carries the server's structured error. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: FieldIssue[];

  constructor(status: number, code: string, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  /** Message for a specific form field, if the server flagged one. */
  issueFor(path: string): string | undefined {
    return this.issues.find((issue) => issue.path === path)?.message;
  }
}

/* ───────────────────────────── Token storage ────────────────────────────── */

/**
 * Tokens live in localStorage.
 *
 * The genuinely safer option is an httpOnly cookie, which script cannot read.
 * That is not used here because the same API serves the Expo app, where cookies
 * are awkward, and splitting the auth model across clients invites the kind of
 * subtle divergence that produces security bugs. The mitigations are that
 * access tokens are short-lived and refresh tokens rotate with reuse detection,
 * so a stolen token has a small window and a leaked refresh token is detected.
 */
export const tokens = {
  access: (): string | null => localStorage.getItem(ACCESS_KEY),
  refresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  set(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Notified when the session ends, so the app can redirect to sign-in. */
type SessionEndedHandler = () => void;
let onSessionEnded: SessionEndedHandler = () => {};

export function setSessionEndedHandler(handler: SessionEndedHandler): void {
  onSessionEnded = handler;
}

/* ─────────────────────────────── Refresh ────────────────────────────────── */

/** The in-flight refresh, shared by every caller that needs one. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const refreshToken = tokens.refresh();
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as { accessToken: string; refreshToken: string };
      tokens.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Clear on the next tick so callers awaiting this promise all observe
      // the same result before a new attempt can begin.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

/* ──────────────────────────────── Request ───────────────────────────────── */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip auth for public endpoints. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!options.anonymous) {
      const token = tokens.access();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  };

  let response = await send();

  // One refresh attempt, then replay. Never loop.
  if (response.status === 401 && !options.anonymous && tokens.refresh()) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      response = await send();
    } else {
      tokens.clear();
      onSessionEnded();
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
    }
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !options.anonymous) {
      tokens.clear();
      onSessionEnded();
    }
    const error = (payload as { error?: { code?: string; message?: string; issues?: FieldIssue[] } })
      ?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.issues ?? [],
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
