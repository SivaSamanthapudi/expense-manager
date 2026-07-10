import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthUser } from '../types';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '../services/apiClient';
import { authService, parseApiError } from '../services/authService';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (name: string, password: string, options: { email?: string; mobile?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const persistSession = (user: AuthUser, accessToken: string, refreshToken: string) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem('auth_user', JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('auth_user');
};

const SESSION_VERSION = 'sw_v1';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('idle');

  useEffect(() => {
    // Wipe any stale mock-era session data on first load with real auth
    if (!localStorage.getItem(SESSION_VERSION)) {
      localStorage.clear();
      localStorage.setItem(SESSION_VERSION, '1');
    }

    const stored = localStorage.getItem('auth_user');
    const token = localStorage.getItem(TOKEN_KEY);

    if (!stored || !token) {
      setStatus('unauthenticated');
      return;
    }

    setUser(JSON.parse(stored));
    setStatus('authenticated');

    authService
      .me()
      .then((freshUser) => {
        setUser(freshUser);
        localStorage.setItem('auth_user', JSON.stringify(freshUser));
      })
      .catch(() => {
        setUser(null);
        setStatus('unauthenticated');
        clearSession();
      });
  }, []);

  useEffect(() => {
    const handleForceLogout = () => {
      setUser(null);
      setStatus('unauthenticated');
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    setStatus('loading');
    try {
      const { user: authUser, accessToken, refreshToken } = await authService.login({ identifier, password });
      persistSession(authUser, accessToken, refreshToken);
      setUser(authUser);
      setStatus('authenticated');
    } catch (err) {
      setStatus('unauthenticated');
      throw new Error(parseApiError(err));
    }
  }, []);

  const signup = useCallback(async (name: string, password: string, options: { email?: string; mobile?: string }) => {
    setStatus('loading');
    try {
      const { user: authUser, accessToken, refreshToken } = await authService.signup({
        name,
        password,
        ...(options.email  ? { email:  options.email  } : {}),
        ...(options.mobile ? { mobile: options.mobile } : {}),
      });
      persistSession(authUser, accessToken, refreshToken);
      setUser(authUser);
      setStatus('authenticated');
    } catch (err) {
      setStatus('unauthenticated');
      throw new Error(parseApiError(err));
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) ?? '';
    try {
      await authService.logout(refreshToken);
    } catch {
      // best-effort
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
