import { Navigate, Outlet } from "react-router";

import { useAuth } from "~/lib/auth";

export default function ProtectedLayout() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bb-gray-50">
        <p className="text-base font-medium text-bb-gray-500">
          Checking sign-in…
        </p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
