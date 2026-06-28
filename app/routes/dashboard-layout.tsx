import { Outlet } from "react-router";

import { UserMenu } from "~/components/user-menu";

export default function DashboardLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-bb-gray-50">
      <header className="border-b border-bb-gray-100 bg-bb-white px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="/brand/logo.png"
              alt="Blood Bikes Wales"
              className="size-8 shrink-0"
            />
            <span className="truncate text-base font-bold text-bb-navy">
              Plasma Controller
            </span>
          </div>
          <UserMenu />
        </div>
      </header>
      <main className="flex-1 p-5">
        <Outlet />
      </main>
    </div>
  );
}
