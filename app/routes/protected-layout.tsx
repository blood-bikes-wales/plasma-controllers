import { Navigate, Outlet, useLocation } from "react-router";

import { useAuth } from "~/lib/auth";
import {
  canAccessPath,
  hasPlasmaAccess,
  homePathForRole,
  needsRoleSelection,
} from "~/lib/capabilities";

function LoadingSignIn() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-bb-gray-50">
      <p className="text-base font-medium text-bb-gray-500">
        Checking sign-in…
      </p>
    </div>
  );
}

export default function ProtectedLayout() {
  const { status, user, activeRole } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const roles = user?.roles ?? [];

  if (status === "loading") {
    return <LoadingSignIn />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (!hasPlasmaAccess(roles)) {
    if (path === "/no-access") {
      return <Outlet />;
    }
    return <Navigate to="/no-access" replace />;
  }

  if (path === "/no-access") {
    return <Navigate to={homePathForRole(activeRole)} replace />;
  }

  if (path === "/select-role") {
    if (roles.length < 2) {
      return <Navigate to={homePathForRole(activeRole)} replace />;
    }
    return <Outlet />;
  }

  if (needsRoleSelection(roles, activeRole)) {
    return <Navigate to="/select-role" replace />;
  }

  if (!canAccessPath(activeRole, path)) {
    return <Navigate to={homePathForRole(activeRole)} replace />;
  }

  return <Outlet />;
}
