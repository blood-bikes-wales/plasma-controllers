import { LoginForm } from "~/components/login-form";

import type { Route } from "./+types/login";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Sign in — Plasma Controller" }];
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs">
        <LoginForm />
      </div>
    </div>
  );
}
