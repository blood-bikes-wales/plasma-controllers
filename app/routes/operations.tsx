import { NavLink, Outlet } from "react-router";

import { cn } from "~/lib/utils";

import type { Route } from "./+types/operations";

const OPERATIONS_NAV = [
  { to: "postcode-areas", label: "Postcode areas" },
  { to: "section-172", label: "Section 172" },
] as const;

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Operations — Plasma Controller" }];
}

function subNavLinkClass({ isActive }: { isActive: boolean }) {
  const base =
    "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
  if (isActive) {
    return cn(base, "bg-bb-navy text-bb-white dark:bg-bb-navy-light");
  }

  return cn(
    base,
    "bg-bb-white text-bb-gray-700 ring-1 ring-bb-gray-200 hover:bg-bb-gray-50 dark:bg-card dark:text-bb-gray-300 dark:ring-bb-gray-700 dark:hover:bg-muted/50",
  );
}

export default function OperationsLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-5 pt-6">
        <h1 className="text-2xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
          Operations
        </h1>
        <nav
          aria-label="Operations"
          className="flex flex-wrap items-center gap-2"
        >
          {OPERATIONS_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={subNavLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
