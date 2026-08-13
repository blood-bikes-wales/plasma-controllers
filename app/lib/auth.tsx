import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router";

import { ApiError, apiFetch, UNAUTHORIZED_EVENT } from "~/lib/api-client";
import { clearAuthToken, getAuthToken, setAuthToken } from "~/lib/auth-token";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  google_id: string | null;
  email_verified_at: string | null;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  loginWithCredential: (idToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(token?: string): Promise<AuthUser> {
  return apiFetch<AuthUser>("/me", {
    token,
    // During login we pass the Google ID token explicitly before it is stored.
  });
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const navigate = useNavigate();

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setStatus("unauthenticated");
      return;
    }

    try {
      const me = await fetchMe(token);
      setUser(me);
      setStatus("authenticated");
    } catch (error) {
      if (isUnauthorized(error)) {
        clearAuthToken();
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      // Keep the session on transient failures (network, 5xx, invalid JSON).
      setStatus("authenticated");
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearAuthToken();
      setUser(null);
      setStatus("unauthenticated");
    };

    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const loginWithCredential = useCallback(async (idToken: string) => {
    const me = await fetchMe(idToken);
    setAuthToken(idToken);
    setUser(me);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setStatus("unauthenticated");
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      user,
      status,
      loginWithCredential,
      logout,
      refreshUser,
    }),
    [user, status, loginWithCredential, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
