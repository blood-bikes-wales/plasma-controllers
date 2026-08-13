import { Navigate } from "react-router";

import { useAuth } from "~/lib/auth";

export default function Index() {
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

  return (
    <Navigate to={status === "authenticated" ? "/jobs" : "/login"} replace />
  );
}
