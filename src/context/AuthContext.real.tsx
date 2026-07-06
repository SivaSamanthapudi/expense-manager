/**
 * Production AuthContext — drop-in replacement for AuthContext.tsx.
 *
 * To switch the app to real API auth:
 *   1. Set REACT_APP_API_BASE_URL in .env (e.g. http://localhost:4000/api)
 *   2. Replace the import in App.tsx:
 *        import { AuthProvider } from './context/AuthContext.real';
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AuthUser } from '../types';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '../services/apiClient';
import { authService, parseApiError } from '../services/authService';

// ── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated';

interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const persistSession = (
  user: AuthUser,
  accessToken: string,
  refreshToken: string
) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem('auth_user', JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('auth_user');
};

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('idle');

  // On mount: rehydrate from localStorage, then verify the token with the server
  useEffect(() => {
    const stored = localStorage.getItem('auth_user');
    const token = localStorage.getItem(TOKEN_KEY);

    if (!stored || !token) {
      setStatus('unauthenticated');
      return;
    }

    // Optimistically set user from cache so the UI is immediately responsive
    setUser(JSON.parse(stored));
    setStatus('authenticated');

    // Silently verify with /auth/me to detect expired/revoked tokens
    authService
      .me()
      .then((freshUser) => {
        setUser(freshUser);
        localStorage.setItem('auth_user', JSON.stringify(freshUser));
      })
      .catch(() => {
        // Token invalid — the axios interceptor already cleared tokens on 401
        setUser(null);
        setStatus('unauthenticated');
        clearSession();
      });
  }, []);

  // Listen for forced logout events fired by the axios 401 interceptor
  useEffect(() => {
    const handleForceLogout = () => {
      setUser(null);
      setStatus('unauthenticated');
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setStatus('loading');
    try {
      const {
        user: authUser,
        accessToken,
        refreshToken,
      } = await authService.login({ email, password });
      persistSession(authUser, accessToken, refreshToken);
      setUser(authUser);
      setStatus('authenticated');
    } catch (err) {
      setStatus('unauthenticated');
      throw new Error(parseApiError(err));
    }
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      setStatus('loading');
      try {
        const {
          user: authUser,
          accessToken,
          refreshToken,
        } = await authService.signup({ name, email, password });
        persistSession(authUser, accessToken, refreshToken);
        setUser(authUser);
        setStatus('authenticated');
      } catch (err) {
        setStatus('unauthenticated');
        throw new Error(parseApiError(err));
      }
    },
    []
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) ?? '';
    try {
      await authService.logout(refreshToken);
    } catch {
      // Best-effort — clear locally regardless of server response
    } finally {
      clearSession();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
