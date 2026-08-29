import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router";

import {
  clearActiveRole as clearStoredActiveRole,
  getActiveRole as getStoredActiveRole,
  setActiveRole as persistActiveRole,
} from "~/lib/active-role";
import { ApiError, apiFetch, UNAUTHORIZED_EVENT } from "~/lib/api-client";
import { clearAuthToken, getAuthToken, setAuthToken } from "~/lib/auth-token";
import { postAuthPath } from "~/lib/capabilities";
import { parseRoles, type Role } from "~/lib/roles";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  google_id: string | null;
  email_verified_at: string | null;
  roles: Role[];
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  activeRole: Role | null;
  postAuthPath: string;
  loginWithCredential: (idToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setActiveRole: (role: Role) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(token?: string): Promise<AuthUser> {
  const user = await apiFetch<Omit<AuthUser, "roles"> & { roles?: string[] }>(
    "/me",
    {
      token,
      // During login we pass the Google ID token explicitly before it is stored.
    },
  );

  return {
    ...user,
    roles: parseRoles(user.roles),
  };
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function resolveActiveRole(roles: Role[], stored: Role | null): Role | null {
  if (roles.length === 0) {
    return null;
  }

  const [onlyRole] = roles;
  if (roles.length === 1 && onlyRole) {
    return onlyRole;
  }

  if (stored && roles.includes(stored)) {
    return stored;
  }

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [activeRole, setActiveRoleState] = useState<Role | null>(null);
  const navigate = useNavigate();

  const applyAuthenticatedUser = useCallback((nextUser: AuthUser) => {
    const nextRole = resolveActiveRole(nextUser.roles, getStoredActiveRole());
    setUser(nextUser);
    setActiveRoleState(nextRole);
    setStatus("authenticated");
    if (!nextRole) {
      clearStoredActiveRole();
      return;
    }
    persistActiveRole(nextRole);
  }, []);

  const clearSession = useCallback(() => {
    clearAuthToken();
    clearStoredActiveRole();
    setUser(null);
    setActiveRoleState(null);
    setStatus("unauthenticated");
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      clearSession();
      return;
    }

    try {
      const me = await fetchMe(token);
      applyAuthenticatedUser(me);
    } catch (error) {
      if (isUnauthorized(error)) {
        clearSession();
        return;
      }

      // Keep the session on transient failures (network, 5xx, invalid JSON).
      setStatus("authenticated");
    }
  }, [applyAuthenticatedUser, clearSession]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
    };

    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, [clearSession]);

  const loginWithCredential = useCallback(
    async (idToken: string) => {
      const me = await fetchMe(idToken);
      setAuthToken(idToken);
      applyAuthenticatedUser(me);
    },
    [applyAuthenticatedUser],
  );

  const logout = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [clearSession, navigate]);

  const setActiveRole = useCallback(
    (role: Role) => {
      if (!user?.roles.includes(role)) {
        return;
      }
      persistActiveRole(role);
      setActiveRoleState(role);
    },
    [user],
  );

  const destination = useMemo(
    () => postAuthPath(user?.roles ?? [], activeRole),
    [user, activeRole],
  );

  const value = useMemo(
    () => ({
      user,
      status,
      activeRole,
      postAuthPath: destination,
      loginWithCredential,
      logout,
      refreshUser,
      setActiveRole,
    }),
    [
      user,
      status,
      activeRole,
      destination,
      loginWithCredential,
      logout,
      refreshUser,
      setActiveRole,
    ],
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
