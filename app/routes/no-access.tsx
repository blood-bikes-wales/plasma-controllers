import { Button } from "~/components/ui/button";
import { useAuth } from "~/lib/auth";

import type { Route } from "./+types/no-access";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "No access — Plasma Controller" }];
}

export default function NoAccessPage() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-bb-gray-50 p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <img
          src="/brand/logo.png"
          alt="Blood Bikes Wales"
          className="size-16"
        />
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-extrabold text-bb-gray-900">
            You don’t have access to Plasma
          </h1>
          <p className="text-base font-medium text-bb-gray-700">
            Your Google account is signed in, but it does not have a Plasma
            role. Ask a coordinator if you need access.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full max-w-xs rounded-bb-button text-lg font-semibold"
          onClick={logout}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
