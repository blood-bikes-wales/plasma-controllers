import type { Route } from "./+types/dashboard";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Dashboard — Plasma Controller" }];
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[28px] font-extrabold text-bb-navy">Dashboard</h1>
      <p className="mt-4 text-base font-medium text-bb-gray-700">
        Welcome to Plasma Controller. Authentication will gate this page in a
        future update.
      </p>
    </div>
  );
}
