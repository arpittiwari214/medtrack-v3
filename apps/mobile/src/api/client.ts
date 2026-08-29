/**
 * HTTP client for the mobile app.
 *
 * Same contract as the web client — transparent single-flight token refresh —
 * with two mobile-specific differences:
 *
 *  - Tokens come from the keychain, not localStorage.
 *  - Every request carries an explicit timeout. Mobile networks fail by hanging
 *    rather than by refusing, and a fetch with no timeout can leave a screen
 *    spinning indefinitely on a train.
 */

import { API_URL } from '../config';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../storage/secure';

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: { path: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

/** Thrown when the request could not reach the server at all. */
export class OfflineError extends Error {
  constructor() {
    super('No connection. Your changes are saved and will sync when you are back online.');
    this.name = 'OfflineError';
  }
}

let onSessionEnded: () => void = () => {};

export function setSessionEndedHandler(handler: () => void): void {
  onSessionEnded = handler;
}

/* ─────────────────────────────── Refresh ────────────────────────────────── */

let refreshInFlight: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  // Shared, because refresh tokens rotate: two concurrent refreshes would make
  // the second present an already-rotated token, which the server correctly
  // treats as theft and responds to by ending every session.
  refreshInFlight ??= (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;

      const data = (await response.json()) as { accessToken: string; refreshToken: string };
      await setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

/* ──────────────────────────────── Request ───────────────────────────────── */

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  anonymous?: boolean;
  timeoutMs?: number;
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!options.anonymous) {
      const token = await getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      return await fetch(`${API_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let response: Response;
  try {
    response = await send();
  } catch {
    // Abort or DNS failure — indistinguishable here, and both mean "no server".
    throw new OfflineError();
  }

  if (response.status === 401 && !options.anonymous) {
    if (await refresh()) {
      try {
        response = await send();
      } catch {
        throw new OfflineError();
      }
    } else {
      await clearTokens();
      onSessionEnded();
      throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in again.');
    }
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string; issues?: { path: string; message: string }[] };
  } | null;

  if (!response.ok) {
    if (response.status === 401) {
      await clearTokens();
      onSessionEnded();
    }
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'UNKNOWN',
      payload?.error?.message ?? 'Something went wrong.',
      payload?.error?.issues ?? [],
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: Options) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Options) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Options) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Options) => request<T>(path, { ...options, method: 'DELETE' }),
};
