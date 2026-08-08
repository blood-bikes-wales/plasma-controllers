import { Navigate } from "react-router";

import { getAuthToken } from "~/lib/auth-token";

export default function Index() {
  const hasToken = Boolean(getAuthToken());
  return <Navigate to={hasToken ? "/jobs" : "/login"} replace />;
}
