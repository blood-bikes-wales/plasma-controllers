import { Outlet } from "react-router";

import type { Route } from "./+types/operations";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Operations — Plasma Controller" }];
}

export default function OperationsLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pt-6">
        <h1 className="text-2xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
          Operations
        </h1>
      </div>
      <Outlet />
    </div>
  );
}
