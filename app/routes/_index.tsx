import { Navigate } from "react-router";

import { useAuth } from "~/lib/auth";

export default function Index() {
  const { status, postAuthPath } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bb-gray-50">
        <p className="text-base font-medium text-bb-gray-500">
          Checking sign-in…
        </p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={postAuthPath} replace />;
}
