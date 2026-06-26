import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthUser {
  id: number;
  username: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Global hook so non-React code (QueryClient subscriber) can trigger logout
let _globalLogout: (() => void) | null = null;
export function triggerSessionExpired() {
  localStorage.removeItem(TOKEN_KEY);
  _globalLogout?.();
}

const TOKEN_KEY = "arb_token";

async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json() as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, user: null, loading: true });

  // Register token getter for all API calls
  useEffect(() => {
    setAuthTokenGetter(() => state.token);
  }, [state.token]);

  // On mount: check if stored token is still valid
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setState({ token: null, user: null, loading: false });
      return;
    }
    verifyToken(stored).then((user) => {
      if (user) {
        setState({ token: stored, user, loading: false });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setState({ token: null, user: null, loading: false });
      }
    });
  }, []);

  const login = useCallback((token: string, user: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    setState({ token, user, loading: false });
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await fetch(`/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* ignore */ }
    }
    localStorage.removeItem(TOKEN_KEY);
    setState({ token: null, user: null, loading: false });
  }, []);

  // Register global logout so QueryClient 401 handler can trigger it
  useEffect(() => {
    _globalLogout = () => setState({ token: null, user: null, loading: false });
    return () => { _globalLogout = null; };
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAuthenticated: !!state.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
