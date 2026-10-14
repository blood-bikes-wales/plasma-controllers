import { NavLink, Outlet, useLocation } from "react-router";

import { UserMenu } from "~/components/user-menu";
import { useAuth } from "~/lib/auth";
import { childNavForPath, navAreasForRole } from "~/lib/capabilities";
import { cn } from "~/lib/utils";

function primaryNavLinkClass({ isActive }: { isActive: boolean }) {
  const base =
    "shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
  if (isActive) {
    return cn(base, "bg-bb-cta text-bb-white dark:bg-primary");
  }

  return cn(
    base,
    "text-bb-gray-700 hover:bg-bb-gray-100 dark:text-bb-gray-300 dark:hover:bg-muted/50",
  );
}

function childNavLinkClass({ isActive }: { isActive: boolean }) {
  const base =
    "-mb-px shrink-0 border-b-2 px-1 pb-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
  if (isActive) {
    return cn(
      base,
      "border-bb-cta text-bb-cta dark:border-primary dark:text-primary",
    );
  }

  return cn(
    base,
    "border-transparent text-bb-gray-500 hover:text-bb-gray-900 dark:text-bb-gray-400 dark:hover:text-bb-gray-100",
  );
}

export default function DashboardLayout() {
  const { activeRole } = useAuth();
  const { pathname } = useLocation();
  const navItems = navAreasForRole(activeRole);
  const childNavItems = childNavForPath(pathname);

  return (
    <div className="flex min-h-svh flex-col bg-bb-gray-50">
      <header className="border-b border-bb-gray-100 bg-bb-white px-5 pt-3">
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
        <nav
          aria-label="Primary"
          className="-mx-1 mt-3 flex items-center gap-2 overflow-x-auto px-1 pb-3"
        >
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={primaryNavLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        {childNavItems.length > 0 ? (
          <nav
            aria-label="Secondary"
            className="-mx-5 flex items-center gap-5 overflow-x-auto border-t border-bb-gray-100 px-5 pt-2"
          >
            {childNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={childNavLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="flex-1 p-5">
        <Outlet />
      </main>
    </div>
  );
}
