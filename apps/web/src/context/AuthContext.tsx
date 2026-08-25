/**
 * Authentication state.
 *
 * The session is verified against the server on mount rather than trusted from
 * localStorage, so a revoked session (signed out elsewhere, password changed)
 * is discovered immediately instead of producing a UI that looks signed in and
 * fails on every request.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@medtrack/shared';
import { setSessionEndedHandler, tokens } from '../api/client.js';
import { authApi } from '../api/endpoints.js';

interface AuthContextValue {
  user: User | null;
  /** True until the initial session check completes. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (input: SignUpInput) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  timezone: string;
  acceptedTerms: true;
  acceptedPrivacy: true;
  marketingEmail?: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // The client calls this when a refresh fails, so the UI clears rather than
  // sitting in a signed-in state that no longer works.
  useEffect(() => {
    setSessionEndedHandler(() => setUser(null));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!tokens.access()) {
        setLoading(false);
        return;
      }
      try {
        const { user: current } = await authApi.me();
        if (!cancelled) setUser(current);
      } catch {
        tokens.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    tokens.set(result.accessToken, result.refreshToken);
    setUser(result.user);
    return result.user;
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await authApi.signup(input);
    tokens.set(result.accessToken, result.refreshToken);
    setUser(result.user);
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Signing out must always succeed locally, even if the network call
      // fails — otherwise a user on a shared device cannot get out.
    }
    tokens.clear();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const { user: current } = await authApi.me();
    setUser(current);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refresh, setUser }),
    [user, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
