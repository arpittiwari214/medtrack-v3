/**
 * Choosing the API base URL.
 *
 * Kept free of Expo imports so it can be exercised by a plain Node test; the
 * Expo-specific values are read in `config.ts` and passed in.
 */

export const API_PORT = 5000;

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])\b/;

export interface ApiUrlInputs {
  /** `extra.apiUrl` from app.json, if set. */
  configured?: string | undefined;
  /** Expo's dev host, e.g. `192.168.1.6:8081`. Absent in a production build. */
  hostUri?: string | undefined;
  /** React Native's `__DEV__`. */
  dev: boolean;
}

/**
 * `localhost` on a physical phone means the phone itself, so the localhost
 * default cannot work on real hardware — and hardcoding a LAN IP instead breaks
 * whenever the router hands out a different lease or the project moves machine.
 *
 * Expo already knows the developer's address, because the phone just connected
 * to it to fetch the bundle. In development we reuse that host and assume the
 * API runs beside Metro on its own port. A configured non-localhost URL always
 * wins, so staging and production builds are unaffected.
 */
export function pickApiUrl({ configured, hostUri, dev }: ApiUrlInputs): string {
  const fallback = `http://localhost:${API_PORT}/api`;
  const configuredIsLocalhost = !configured || LOCALHOST.test(configured);

  if (dev && configuredIsLocalhost) {
    const host = hostUri?.split(':')[0]?.trim();
    if (host) return `http://${host}:${API_PORT}/api`;
  }

  return configured ?? fallback;
}
